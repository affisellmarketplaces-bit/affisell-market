import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  EXPECTED_COLUMNS,
  EXPECTED_CONSTRAINTS,
  EXPECTED_INDEXES,
  EXPECTED_TRIGGERS,
  buildPresenceReadinessReport,
  formatPresenceReadiness,
  staticChecks,
  triggerDefects,
  type CatalogFacts,
  type IntegrityFacts,
  type ReadinessInput,
  type TriggerState,
} from "@/lib/listing-presence/integrity"
import { decideReportRun, type ReportDatabaseTarget } from "@/lib/reports/report-target"

const MIGRATION = readFileSync("prisma/migrations/20261124090000_listing_presence_history/migration.sql", "utf8")
const ROLLBACK = readFileSync("scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql", "utf8")
const NOW = new Date("2026-11-24T12:00:00Z")

/** Body of a plpgsql function as `pg_proc.prosrc` holds it: what is between the $$ of the migration. */
const bodyOf = (fn: string) => {
  const start = MIGRATION.indexOf(`FUNCTION ${fn}()`)
  const a = MIGRATION.indexOf("$$", start)
  return MIGRATION.slice(a + 2, MIGRATION.indexOf("$$", a + 2))
}
/** What `pg_get_triggerdef` prints for the migration's triggers. */
const DEFS: Record<string, string> = {
  AffiliateProduct_listing_presence_history:
    'CREATE TRIGGER "AffiliateProduct_listing_presence_history" AFTER INSERT OR DELETE OR UPDATE OF "isListed" ON public."AffiliateProduct" FOR EACH ROW EXECUTE FUNCTION affisell_record_listing_presence()',
  ListingPresenceEvent_append_only:
    'CREATE TRIGGER "ListingPresenceEvent_append_only" BEFORE DELETE OR UPDATE ON public."ListingPresenceEvent" FOR EACH ROW EXECUTE FUNCTION affisell_listing_presence_append_only()',
  ListingPresenceEvent_no_truncate:
    'CREATE TRIGGER "ListingPresenceEvent_no_truncate" BEFORE TRUNCATE ON public."ListingPresenceEvent" FOR EACH STATEMENT EXECUTE FUNCTION affisell_listing_presence_no_truncate()',
}
const goodTriggers = (): TriggerState[] =>
  EXPECTED_TRIGGERS.map((t) => ({ name: t.name, table: t.table, enabled: "O", definition: DEFS[t.name]!, functionBody: bodyOf(t.fn) }))

const catalog = (o: Partial<CatalogFacts> = {}): CatalogFacts => ({
  migrationRow: "applied",
  migrationFinishedAt: new Date("2026-11-01T00:00:00Z"),
  tableExists: true,
  columns: [...EXPECTED_COLUMNS],
  constraints: [...EXPECTED_CONSTRAINTS],
  indexes: [...EXPECTED_INDEXES],
  triggers: goodTriggers(),
  sessionReplicationRole: "origin",
  replicaDefaults: 0,
  roleMaySetReplicationRole: false,
  roleIsSuperuser: false,
  roleOwnsTable: false,
  roleHasTruncate: false,
  ...o,
})
const integrity = (o: Partial<IntegrityFacts> = {}): IntegrityFacts => ({
  events: 40,
  truncated: false,
  byKind: { created: 10, listed: 10, unlisted: 15, deleted: 5 },
  bySource: { reseller_ui: 38, unattributed: 2 },
  futureEvents: 0,
  beforeTrackingStart: 0,
  chainBreaks: 0,
  createdNotFirst: 0,
  afterDeleted: 0,
  orderInversions: 0,
  duplicates: 0,
  orphanListings: 0,
  deletedButPresent: 0,
  stateMismatches: 0,
  createdWithoutEvent: 0,
  attributionMismatches: 0,
  preExistingListings: 12,
  reintroducedPairs: 1,
  relistings: 4,
  ...o,
})
const input = (o: Partial<ReadinessInput> = {}): ReadinessInput => ({
  now: NOW,
  staticFacts: { migrationFilePresent: true, migrationSql: MIGRATION, rollbackSql: ROLLBACK },
  catalog: catalog(),
  integrity: integrity(),
  volumes: { listingsWithHistory: 20, products: 8, resellers: 6, completePeriods: 12, ongoingPeriods: 8, unjudgedPeriods: 12, periodsWithSale: 5, censoredPeriods: 15, historyDays: 23 },
  engines: [{ id: "temporal", name: "Temporal Opportunities Engine", level: 2, levelLabel: "Testé", state: "en_attente_de_donnees", mainGap: "first_sales : 5 / 20" }],
  databaseNotReadReason: null,
  ...o,
})
const status = (r: ReturnType<typeof buildPresenceReadinessReport>, id: string) => r.checks.find((c) => c.id === id)?.status

describe("migration and rollback (static, the repository)", () => {
  it("the migration describes every expected object, the TRUNCATE guard included, and no backfill", () => {
    for (const c of staticChecks({ migrationFilePresent: true, migrationSql: MIGRATION, rollbackSql: ROLLBACK })) expect(c.status, c.id).toBe("PASS")
    expect(MIGRATION).toMatch(/BEFORE TRUNCATE ON "ListingPresenceEvent"\s+FOR EACH STATEMENT EXECUTE FUNCTION affisell_listing_presence_no_truncate\(\)/)
    expect(bodyOf("affisell_listing_presence_no_truncate")).toContain("affisell.listing_presence_truncate")
    expect(ROLLBACK.indexOf('"ListingPresenceEvent_no_truncate"')).toBeLessThan(ROLLBACK.indexOf('DROP TABLE IF EXISTS "ListingPresenceEvent"'))
  })
  it("a migration without the TRUNCATE guard, or with an invented history, is BLOCKED", () => {
    const noGuard = MIGRATION.replace(/"ListingPresenceEvent_no_truncate"/g, '"x"')
    expect(staticChecks({ migrationFilePresent: true, migrationSql: noGuard, rollbackSql: ROLLBACK }).find((c) => c.id === "A2_migration_content")?.status).toBe("BLOCKED")
    const backfill = `${MIGRATION}\nINSERT INTO "ListingPresenceEvent" ("kind") SELECT 'created' FROM "AffiliateProduct";`
    expect(staticChecks({ migrationFilePresent: true, migrationSql: backfill, rollbackSql: ROLLBACK }).find((c) => c.id === "A2_migration_content")?.status).toBe("BLOCKED")
    expect(staticChecks({ migrationFilePresent: false, migrationSql: null, rollbackSql: null })[0]!.status).toBe("BLOCKED")
  })
})

describe("triggers — present, correct, enabled", () => {
  const cap = EXPECTED_TRIGGERS[0]!
  it("the migration's own triggers are conform", () => {
    for (const t of EXPECTED_TRIGGERS) expect(triggerDefects(t, goodTriggers().find((x) => x.name === t.name)), t.name).toEqual([])
  })
  it("absent", () => expect(triggerDefects(cap, undefined)).toEqual(["absent"]))
  it("present but incorrect: wrong timing, missing event, other column, wrong function, body edited", () => {
    const g = goodTriggers()[0]!
    expect(triggerDefects(cap, { ...g, definition: g.definition.replace("AFTER", "BEFORE") }).length).toBeGreaterThan(0)
    expect(triggerDefects(cap, { ...g, definition: g.definition.replace(" OR DELETE", "") }).join()).toContain("DELETE")
    expect(triggerDefects(cap, { ...g, definition: g.definition.replace('UPDATE OF "isListed"', 'UPDATE OF "isListed", "customTitle"') }).join()).toContain("UPDATE OF")
    expect(triggerDefects(cap, { ...g, definition: g.definition.replace("affisell_record_listing_presence", "other_fn") }).join()).toContain("fonction other_fn")
    expect(triggerDefects(cap, { ...g, functionBody: g.functionBody!.replace("IS DISTINCT FROM", "<>") }).join()).toContain("IS DISTINCT FROM")
    expect(triggerDefects(cap, { ...g, table: "Product" }).join()).toContain("table Product")
  })
  it("the earlier draft of the capture function (session-time-zone instant) is reported as incorrect", () => {
    const g = goodTriggers()[0]!
    const draft = g.functionBody!.replaceAll("(clock_timestamp() AT TIME ZONE 'UTC')", "clock_timestamp()")
    expect(triggerDefects(cap, { ...g, functionBody: draft }).join()).toContain("AT TIME ZONE 'UTC'")
  })
  it("disabled (D) or replica-only (R) → BLOCKED; always (A) is accepted", () => {
    for (const en of ["D", "R"]) {
      const r = buildPresenceReadinessReport(input({ catalog: catalog({ triggers: goodTriggers().map((t) => (t.name === cap.name ? { ...t, enabled: en } : t)) }) }))
      expect(status(r, `B_${cap.name}`), en).toBe("BLOCKED")
      expect(r.global).toBe("BLOCKED")
    }
    const always = buildPresenceReadinessReport(input({ catalog: catalog({ triggers: goodTriggers().map((t) => ({ ...t, enabled: "A" })) }) }))
    expect(status(always, `B_${cap.name}`)).toBe("PASS")
  })
  it("TRUNCATE guard absent → BLOCKED", () => {
    const r = buildPresenceReadinessReport(input({ catalog: catalog({ triggers: goodTriggers().filter((t) => t.name !== "ListingPresenceEvent_no_truncate") }) }))
    expect(status(r, "B_ListingPresenceEvent_no_truncate")).toBe("BLOCKED")
  })
})

describe("migration state", () => {
  it("not applied → BLOCKED with the founder's decision as action", () => {
    const r = buildPresenceReadinessReport(input({ catalog: catalog({ migrationRow: "absent", migrationFinishedAt: null, tableExists: false, triggers: [] }), integrity: null, volumes: null, engines: null }))
    expect(status(r, "A4_migration_applied")).toBe("BLOCKED")
    expect(r.global).toBe("BLOCKED")
    expect(r.actions.join()).toMatch(/décision fondateur : appliquer la migration/)
  })
  it("applied, conform, consistent data → no blocker; failed or rolled back → BLOCKED; unreadable → UNKNOWN", () => {
    const ok = buildPresenceReadinessReport(input())
    expect(ok.checks.filter((c) => c.status === "BLOCKED")).toEqual([])
    expect(["PASS", "WARN"]).toContain(ok.global)
    for (const row of ["failed", "rolled_back"] as const) expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ migrationRow: row }) })), "A4_migration_applied")).toBe("BLOCKED")
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ migrationRow: "unreadable" }) })), "A4_migration_applied")).toBe("UNKNOWN")
  })
  it("schema installed without the migration record (db push / by hand) → WARN on top of the blocker", () => {
    const r = buildPresenceReadinessReport(input({ catalog: catalog({ migrationRow: "absent", migrationFinishedAt: null }) }))
    expect(status(r, "A7_schema_without_record")).toBe("WARN")
  })
  it("a missing column or constraint → BLOCKED; a missing index → WARN", () => {
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ columns: EXPECTED_COLUMNS.filter((c) => c !== "source") }) })), "A5_table")).toBe("BLOCKED")
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ constraints: ["ListingPresenceEvent_pkey"] }) })), "A6_constraints_indexes")).toBe("BLOCKED")
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ indexes: [] }) })), "A6_constraints_indexes")).toBe("WARN")
  })
})

describe("replication role — what can and can not be seen", () => {
  it("a role or database set to replica by default → BLOCKED; this session in replica → BLOCKED", () => {
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ replicaDefaults: 1 }) })), "E_replication_role")).toBe("BLOCKED")
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ sessionReplicationRole: "replica" }) })), "E_replication_role")).toBe("BLOCKED")
  })
  it("a role able to switch to replica → WARN; settings unreadable → UNKNOWN, never PASS", () => {
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ roleMaySetReplicationRole: true }) })), "E_replication_role")).toBe("WARN")
    expect(status(buildPresenceReadinessReport(input({ catalog: catalog({ roleIsSuperuser: true }) })), "E_replication_role")).toBe("WARN")
    const r = buildPresenceReadinessReport(input({ catalog: catalog({ replicaDefaults: null }) }))
    expect(status(r, "E_replication_role")).toBe("UNKNOWN")
    expect(r.global).not.toBe("PASS")
  })
  it("says plainly that other sessions are invisible and that only the data reconciliation reveals a silent capture", () => {
    const ev = buildPresenceReadinessReport(input()).checks.find((c) => c.id === "E_replication_role")!.evidence.join(" ")
    expect(ev).toMatch(/AUTRES connexions ne sont pas visibles/)
    expect(ev).toMatch(/rapprochement des données/)
  })
  it("the table owner can disable protections → WARN with the role separation proposal", () => {
    const r = buildPresenceReadinessReport(input({ catalog: catalog({ roleOwnsTable: true, roleHasTruncate: true }) }))
    expect(status(r, "E_owner_privileges")).toBe("WARN")
    expect(r.actions.join()).toMatch(/rôle applicatif distinct/)
  })
})

describe("integrity — abnormal sequences, missing data, isolation", () => {
  it("no event yet = UNKNOWN (never zero, never PASS)", () => {
    const r = buildPresenceReadinessReport(input({ integrity: integrity({ events: 0, byKind: {}, bySource: {} }) }))
    for (const id of ["B_capture_observed", "B_idempotence", "C_sequences", "C_orphans_isolation"]) expect(status(r, id), id).toBe("UNKNOWN")
    expect(r.global).toBe("UNKNOWN")
  })
  it.each([
    ["chainBreaks", "C_sequences"],
    ["createdNotFirst", "C_sequences"],
    ["afterDeleted", "C_sequences"],
    ["futureEvents", "C_sequences"],
    ["duplicates", "B_idempotence"],
    ["orphanListings", "C_orphans_isolation"],
    ["deletedButPresent", "C_orphans_isolation"],
    ["attributionMismatches", "C_orphans_isolation"],
    ["stateMismatches", "B_capture_observed"],
    ["createdWithoutEvent", "B_capture_observed"],
  ] as const)("%s → %s BLOCKED", (field, id) => {
    const r = buildPresenceReadinessReport(input({ integrity: integrity({ [field]: 1 }) }))
    expect(status(r, id)).toBe("BLOCKED")
    expect(r.global).toBe("BLOCKED")
  })
  it("clock inversions only warn; a high unattributed share only warns; unknown edges are expected, not anomalies", () => {
    expect(status(buildPresenceReadinessReport(input({ integrity: integrity({ orderInversions: 2 }) })), "C_sequences")).toBe("WARN")
    expect(status(buildPresenceReadinessReport(input({ integrity: integrity({ bySource: { unattributed: 30, reseller_ui: 10 } }) })), "C_attribution")).toBe("WARN")
    expect(status(buildPresenceReadinessReport(input()), "C_unknown_edges")).toBe("PASS")
  })
  it("a truncated read is signalled; volumes not computed are UNKNOWN, not zero", () => {
    expect(status(buildPresenceReadinessReport(input({ integrity: integrity({ truncated: true }) })), "D_read_cap")).toBe("WARN")
    const r = buildPresenceReadinessReport(input({ volumes: null, engines: null }))
    expect(status(r, "D_volumes")).toBe("UNKNOWN")
    expect(r.checks.find((c) => c.id === "D_volumes")!.evidence[0]).toMatch(/inconnus, pas zéro/)
  })
})

describe("no access / destination", () => {
  it("without any database read: static checks run, every database check is UNKNOWN and listed as not executed", () => {
    const r = buildPresenceReadinessReport(input({ catalog: null, integrity: null, volumes: null, engines: null, databaseNotReadReason: "staging non accessible" }))
    expect(r.global).toBe("UNKNOWN")
    expect(r.notExecuted).toEqual(expect.arrayContaining(["A4_migration_applied", "A5_table", "B_capture_triggers", "E_replication_role", "C_integrite"]))
    expect(r.executed).toEqual(["A1_migration_file", "A2_migration_content", "A3_rollback"])
    expect(formatPresenceReadiness(r)).toContain("staging non accessible")
  })
  const target = (branch: ReportDatabaseTarget["branch"]): ReportDatabaseTarget => ({ source: "shell", endpoint: "ep-x", branch, maskedHost: "ep-x…" })
  it("production is refused even with the confirmation; an unknown destination is refused; staging and local run", () => {
    expect(decideReportRun({ target: target("production"), targetOnly: false, confirmEndpoint: "ep-x", allowProduction: false }).action).toBe("refuse")
    expect(decideReportRun({ target: target("unknown"), targetOnly: false, confirmEndpoint: "ep-x", allowProduction: false }).action).toBe("refuse")
    expect(decideReportRun({ target: target("staging"), targetOnly: false, confirmEndpoint: null, allowProduction: false }).action).toBe("run")
    expect(decideReportRun({ target: target("local"), targetOnly: false, confirmEndpoint: null, allowProduction: false }).action).toBe("run")
    // the other reports keep their behaviour
    expect(decideReportRun({ target: target("production"), targetOnly: false, confirmEndpoint: "ep-x" }).action).toBe("run")
  })
})

describe("the command is read-only and isolated", () => {
  const ROOT = process.cwd()
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const script = strip(readFileSync("scripts/report-presence-readiness.ts", "utf8"))
  const collector = strip(readFileSync("lib/reports/presence-readiness-report.ts", "utf8"))
  function importGraph(entry: string): Set<string> {
    const seen = new Set<string>()
    const stack = [path.join(ROOT, entry)]
    while (stack.length) {
      const file = stack.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const m of readFileSync(file, "utf8").matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
        const spec = m[1] ?? m[2]!
        const target = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null
        if (!target) continue
        const hit = [`${target}.ts`, `${target}.mjs`, target, path.join(target, "index.ts")].find((f) => existsSync(f) && /\.(ts|mjs)$/.test(f))
        if (hit) stack.push(hit)
      }
    }
    return new Set([...seen].map((f) => path.relative(ROOT, f)))
  }
  it("goes through the read-only runner, never allows production, never prints a raw error", () => {
    expect(script).toContain("runReadOnlyReport(")
    expect(script).toContain("allowProduction: false")
    expect(script).not.toMatch(/new PrismaClient\(/)
    expect(script).toMatch(/catch \{/)
    expect(script).not.toMatch(/console\.(log|error)\([^)]*\berr(or)?\b/)
  })
  it("the collector only reads: tagged $queryRaw, no write, no $executeRaw, no $queryRawUnsafe", () => {
    expect(collector).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$queryRawUnsafe/)
    expect(collector).not.toMatch(/set_config|SET (LOCAL|SESSION)|TRUNCATE "|INSERT INTO|UPDATE "|DELETE FROM|ALTER |DROP |CREATE /)
  })
  it("loads no application database client and no server-only module", () => {
    const graph = importGraph("scripts/report-presence-readiness.ts")
    expect(graph.has("lib/reports/presence-readiness-report.ts")).toBe(true)
    for (const f of graph) {
      expect(f, f).not.toMatch(/^lib\/prisma(-radar)?\.ts$|build-write-guard/)
      expect(readFileSync(f, "utf8"), f).not.toMatch(/^import\s+["']server-only["']/m)
    }
  })
  it("is wired as an npm script and its real-database test runs in CI", () => {
    expect(JSON.parse(readFileSync("package.json", "utf8")).scripts["report:presence-readiness"]).toBe("tsx scripts/report-presence-readiness.ts")
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("lib/__tests__/presence-readiness-db.test.ts")
  })
})
