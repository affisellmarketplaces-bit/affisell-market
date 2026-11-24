/**
 * Collection monitor (founder brief 2026-11-24 « Historical Collection Monitor »): sanitised snapshots built from the
 * EXISTING readiness report, deterministic comparison, anomalies with severity, J+1 / J+7 stability that never takes two
 * identical reports for proof, per-engine recommendation that executes nothing — all without staging, production,
 * network or database. Fixtures = the readiness tests' own healthy catalog.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  assertSnapshotClean,
  assessStability,
  buildCollectionSnapshot,
  compareSnapshots,
  detectAnomalies,
  engineObservationDecisions,
  formatMonitorReport,
  parseSnapshot,
  toGateCheckpoint,
  type CollectionSnapshot,
  type SnapshotLabel,
} from "@/lib/launch-gate/collection-monitor"
import {
  EXPECTED_COLUMNS,
  EXPECTED_CONSTRAINTS,
  EXPECTED_INDEXES,
  EXPECTED_TRIGGERS,
  buildPresenceReadinessReport,
  type CatalogFacts,
  type IntegrityFacts,
  type PresenceReadinessReport,
  type ReadinessInput,
  type TriggerState,
} from "@/lib/listing-presence/integrity"
import { ENGINES, type ActivationReadinessReport } from "@/lib/reseller-copilot/activation-readiness"

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

const START = new Date("2026-11-01T00:00:00Z")
const H = 3_600_000
const at = (hours: number) => new Date(START.getTime() + hours * H)
const STAGING = { branch: "staging" as const, endpoint: "ep-shy-wind-test" }

function report(o: { integrity?: Partial<IntegrityFacts> | null; catalog?: Partial<CatalogFacts>; volumes?: Partial<NonNullable<ReadinessInput["volumes"]>>; target?: PresenceReadinessReport["target"]; now: Date }): PresenceReadinessReport {
  const r = buildPresenceReadinessReport(
    input({
      now: o.now,
      catalog: catalog({ migrationFinishedAt: START, ...(o.catalog ?? {}) }),
      integrity: o.integrity === null ? null : integrity({ bySource: { reseller_ui: 40 }, newestEventAt: new Date(o.now.getTime() - H), topResellerEventShare: 0.2, resellersWithEvents: 6, ...(o.integrity ?? {}) }),
      volumes: { listingsWithHistory: 20, products: 8, resellers: 6, completePeriods: 12, ongoingPeriods: 8, unjudgedPeriods: 2, periodsWithSale: 5, censoredPeriods: 15, historyDays: Math.floor((o.now.getTime() - START.getTime()) / (24 * H)), ...(o.volumes ?? {}) },
    }),
  )
  r.target = o.target === undefined ? STAGING : o.target
  return r
}
const snap = (hours: number, label: SnapshotLabel, o: Omit<Parameters<typeof report>[0], "now"> = {}, extra: { commit?: string; activation?: ActivationReadinessReport | null } = {}) =>
  buildCollectionSnapshot({ readiness: report({ ...o, now: at(hours) }), activation: extra.activation ?? null, appCommit: extra.commit ?? "1aed21a15", takenAt: at(hours), label })

const baseline = () => snap(1, "etat_initial", { integrity: { events: 10, byKind: { created: 10, listed: 0, unlisted: 0, deleted: 0 }, bySource: { reseller_ui: 10 } } })
const j1 = (o: Partial<IntegrityFacts> = {}) => snap(26, "J+1", { integrity: { events: 40, bySource: { reseller_ui: 40 }, ...o } })
const j7 = (o: Partial<IntegrityFacts> = {}) => snap(170, "J+7", { integrity: { events: 120, bySource: { reseller_ui: 120 }, ...o } })

function activation(o: { historyDays?: number; resellersMissing?: number; missing?: number } = {}): ActivationReadinessReport {
  return {
    generatedAt: at(170).toISOString(),
    migrationApplied: true,
    trackingStartedAt: START.toISOString(),
    data: { historyDays: o.historyDays ?? 200, coversBlindSpotWindow: true, periods: 100, unjudgedPeriods: 5, censoredShare: 0.3, products: 40, resellers: 12, firstSales: 300, resellersWithSale: 10, fullyFollowedSales: 0, fullyFollowedResellers: 0, salesCadencePerDay: 2, productsAtProductTier: 3, productsAtJudgingFloors: 3, unattributedShare: 0 },
    engines: ENGINES.map((e) => ({ id: e.id, name: e.name, flag: e.flag, mode: "off", dimensions: { technique: 2, donnees: 3, statistique: 3, securite: 2 }, level: 3, levelLabel: "", state: "validation", mainDependency: "", gaps: [{ metric: "x", required: 10, available: 10 - (o.missing ?? 0), missing: o.missing ?? 0 }], resellersRequired: 5, resellersMissing: o.resellersMissing ?? 0, etaDays: null, etaBasis: "", risk: "faible", exitConditions: [], nextAction: "", testsNeeded: [] })),
    sequence: [],
    checklist: [],
    limits: [],
  } as unknown as ActivationReadinessReport
}

describe("snapshot — creation and sanitised export", () => {
  it("identifies time, environment, commit, schema state, checks, volumes, anomalies and limits", () => {
    const s = baseline()
    expect(s).toMatchObject({ format: "affisell.collection-snapshot", version: 1, label: "etat_initial", environment: STAGING, appCommit: "1aed21a15" })
    expect(s.takenAt).toBe(at(1).toISOString())
    expect(s.schema).toMatchObject({ migration: "20261124090000_listing_presence_history", state: "applied", finishedAt: START.toISOString(), tableExists: true })
    expect(s.checks.length).toBeGreaterThan(5)
    expect(s.checks.every((c) => ["PASS", "WARN", "BLOCKED", "UNKNOWN"].includes(c.status))).toBe(true)
    expect(s.triggers.map((t) => t.enabled)).toEqual(["O", "O", "O"])
    expect(s.volumes?.listingsWithHistory).toBe(20)
    expect(s.limits.length).toBeGreaterThan(0)
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
  it("keeps no free text, URL, identifier or secret — evidence dropped, unknown sources folded, bad endpoint masked", () => {
    const r = report({ now: at(5), integrity: { bySource: { reseller_ui: 3, "postgres://u:SECRETPW@host/db": 1 } }, target: { branch: "staging", endpoint: "postgres://u:SECRETPW@host/db" } })
    r.checks[0]!.evidence = ["postgresql://user:SECRETPW@ep-x.neon.tech/db", "vendeur@example.com"]
    const s = buildCollectionSnapshot({ readiness: r, appCommit: "not-a-commit; rm -rf", takenAt: at(5), label: "controle" })
    const text = JSON.stringify(s)
    expect(text).not.toMatch(/SECRETPW|postgres|example\.com|rm -rf/)
    expect(s.environment.endpoint).toBe("non_identifie")
    expect(s.appCommit).toBeNull()
    expect(s.integrity?.bySource).toEqual({ reseller_ui: 3, source_non_reconnue: 1 })
    expect(() => assertSnapshotClean({ x: "postgresql://a:b@c/d" })).toThrow()
    expect(() => assertSnapshotClean({ x: "rk_live_abc" })).toThrow()
    expect(() => parseSnapshot({ format: "autre" })).toThrow()
  })
  it("a static readiness report (no database read) gives unknown facts, never validated", () => {
    const r = buildPresenceReadinessReport(input({ catalog: null, integrity: null, volumes: null, engines: null, databaseNotReadReason: "test", now: at(2) }))
    r.target = STAGING
    const s = buildCollectionSnapshot({ readiness: r, appCommit: null, takenAt: at(2), label: "etat_initial" })
    expect(s.schema.state).toBe("non_lu")
    expect(s.integrity).toBeNull()
    expect(s.global).toBe("UNKNOWN")
    expect(s.anomalies.map((a) => a.code)).toContain("base_non_lue")
  })
})

describe("comparison — deterministic, never across environments", () => {
  it("refuses two different environments, and an unidentified one", () => {
    const prod = snap(26, "J+1", { target: { branch: "production", endpoint: "ep-misty-sea-test" } })
    expect(compareSnapshots(baseline(), prod)).toMatchObject({ comparable: false })
    const unknown = snap(26, "J+1", { target: { branch: "staging", endpoint: "???" } })
    expect(compareSnapshots(unknown, unknown).comparable).toBe(false)
  })
  it("identifies different commits, orders by time, gives volume deltas apart from quality", () => {
    const a = baseline()
    const b = snap(26, "J+1", { integrity: { events: 40, bySource: { reseller_ui: 40 } } }, { commit: "abcdef123" })
    const c = compareSnapshots(b, a) // reversed on purpose
    if (!c.comparable) throw new Error("expected comparable")
    expect(c.from.label).toBe("etat_initial")
    expect(c.sameCommit).toBe(false)
    expect(c.volumes.events).toEqual({ from: 10, to: 40, delta: 30 })
    expect(formatMonitorReport({ comparison: c, stability: null, decisions: null })).toMatch(/COMMITS DIFFÉRENTS/)
    // Same inputs → same output.
    expect(compareSnapshots(a, b)).toEqual(compareSnapshots(a, b))
  })
  it("tracks the eight dimensions per engine with a transition each — never one score", () => {
    const a = snap(26, "J+1", { integrity: { events: 40, bySource: { reseller_ui: 40 } } }, { activation: activation({ resellersMissing: 3 }) })
    const b = snap(170, "J+7", { integrity: { events: 120, bySource: { reseller_ui: 120 } } }, { activation: activation() })
    const c = compareSnapshots(a, b)
    if (!c.comparable) throw new Error("expected comparable")
    expect(new Set(c.dimensions.map((d) => d.dimension)).size).toBe(8)
    expect(c.dimensions.filter((d) => d.engine === "temporal")).toHaveLength(8)
    expect(c.dimensions.find((d) => d.engine === "temporal" && d.dimension === "diversite")?.transition).toBe("amelioration")
    expect(c.dimensions.find((d) => d.engine === "temporal" && d.dimension === "stabilite")?.transition).toBe("stabilite")
    expect(c).not.toHaveProperty("score")
  })
})

describe("anomalies — each with an explanation and a severity", () => {
  it("regression (fewer events, shorter history) is blocking", () => {
    const later = snap(48, "controle", { integrity: { events: 5 }, volumes: { historyDays: 0 } })
    const codes = detectAnomalies(later, j1()).map((a) => `${a.code}:${a.severity}`)
    expect(codes).toContain("historique_en_recul:bloquant")
    expect(codes).toContain("couverture_en_recul:bloquant")
  })
  it("provenance, chronology, duplicates, UTC, gaps, mismatches, concentration, triggers, replica defaults", () => {
    const s = snap(30, "controle", {
      integrity: { bySource: { reseller_ui: 30, unattributed: 3 }, chainBreaks: 2, duplicates: 1, futureEvents: 1, createdWithoutEvent: 2, stateMismatches: 1, topResellerEventShare: 0.8, resellersWithEvents: 3, truncated: true },
      catalog: { replicaDefaults: 1, triggers: catalog().triggers.map((t, i) => (i === 0 ? { ...t, enabled: "D" } : t)) },
    })
    const by = Object.fromEntries(s.anomalies.map((a) => [a.code, a]))
    expect(by.evenements_non_attribues?.severity).toBe("majeur")
    expect(by.ruptures_de_chaine?.severity).toBe("majeur")
    expect(by.doublons?.severity).toBe("majeur")
    expect(by.dates_futures?.severity).toBe("majeur")
    expect(by.periodes_manquantes?.severity).toBe("majeur")
    expect(by.annonce_differente_de_son_historique?.severity).toBe("majeur")
    expect(by.concentration_revendeur?.severity).toBe("mineur")
    expect(by.historique_tronque?.severity).toBe("majeur")
    expect(by.mode_replique_par_defaut?.severity).toBe("bloquant")
    expect(by["declencheur_desactive:AffiliateProduct_listing_presence_history"]?.severity).toBe("bloquant")
    expect(s.anomalies.every((a) => a.explanation.length > 10)).toBe(true)
  })
  it("missing observation: stale newest event, and no new event between two readings", () => {
    const stale = snap(100, "controle", { integrity: { newestEventAt: at(20) } })
    expect(stale.anomalies.map((a) => a.code)).toContain("plus_aucune_observation")
    const flat = snap(60, "controle", { integrity: { events: 40, bySource: { reseller_ui: 40 } } })
    expect(detectAnomalies(flat, j1()).map((a) => a.code)).toContain("aucun_nouvel_evenement")
  })
})

describe("J+1 / J+7 stability — two identical reports are not proof", () => {
  it("J+1 stable with new events, triggers active, reconciled, provenance clean", () => {
    expect(assessStability("J+1", baseline(), j1()).verdict).toBe("stable")
  })
  it("J+1 without new events = preuve_insuffisante (identical reports)", () => {
    const same = snap(26, "J+1", { integrity: { events: 10, bySource: { reseller_ui: 10 } } })
    expect(assessStability("J+1", baseline(), same).verdict).toBe("preuve_insuffisante")
  })
  it("J+1 too early, J+1 on unknown facts, J+1 across environments", () => {
    expect(assessStability("J+1", baseline(), snap(10, "J+1", { integrity: { events: 30 } })).verdict).toBe("observation_trop_precoce")
    const r = buildPresenceReadinessReport(input({ catalog: null, integrity: null, volumes: null, engines: null, databaseNotReadReason: "x", now: at(26) }))
    r.target = STAGING
    const unknown = buildCollectionSnapshot({ readiness: r, appCommit: null, takenAt: at(26), label: "J+1" })
    expect(assessStability("J+1", baseline(), unknown).verdict).toBe("preuve_insuffisante")
    expect(assessStability("J+1", baseline(), snap(26, "J+1", { target: { branch: "production", endpoint: "ep-misty-sea-x" } })).verdict).toBe("comparaison_impossible")
  })
  it("provenance or chronology anomalies make the collection unstable", () => {
    expect(assessStability("J+1", baseline(), j1({ bySource: { reseller_ui: 38, unattributed: 2 } })).verdict).not.toBe("stable")
    expect(assessStability("J+1", baseline(), j1({ chainBreaks: 1 })).verdict).toBe("instable")
  })
  it("J+7 needs the J+1 reading and progress since it; without them = preuve_insuffisante", () => {
    expect(assessStability("J+7", baseline(), j7()).verdict).toBe("preuve_insuffisante")
    expect(assessStability("J+7", baseline(), j7(), j1()).verdict).toBe("stable")
    expect(assessStability("J+7", baseline(), snap(170, "J+7", { integrity: { events: 40, bySource: { reseller_ui: 40 } } }), j1()).verdict).toBe("preuve_insuffisante")
    expect(assessStability("J+7", baseline(), snap(170, "J+7", { integrity: { events: 30 } }), j1()).verdict).toBe("instable") // regression
  })
  it("feeds the launch gate: only stable is PASS; nothing executes", () => {
    const s = assessStability("J+1", baseline(), j1())
    expect(toGateCheckpoint(s)).toBe("PASS")
    expect(toGateCheckpoint(assessStability("J+7", baseline(), j7()))).toBe("UNKNOWN")
    expect(toGateCheckpoint(null)).toBe("UNKNOWN")
    expect(s.executesAutomatically).toBe(false)
  })
})

describe("engine decisions — recommended, never executed, dependency order kept", () => {
  const stableJ7 = () => assessStability("J+7", baseline(), j7(), j1())
  it("without a stable J+7 nothing is observable", () => {
    const d = engineObservationDecisions(j7(), assessStability("J+7", baseline(), j7()))
    expect(d.every((x) => x.status === "maturite_inconnue")).toBe(true)
    expect(d.every((x) => x.executesAutomatically === false && x.requiresAuthorization.includes("E"))).toBe(true)
  })
  it("stable but no maturity data = pret_techniquement for the first, then dependencies hold", () => {
    const d = engineObservationDecisions(j7(), stableJ7(), j1())
    expect(d[0]).toMatchObject({ engine: "temporal", status: "pret_techniquement" })
    expect(d.map((x) => x.engine)).toEqual(["temporal", "blind_spots", "observation_plan", "retention", "contextual_horizon"])
  })
  it("history too short = historique_insuffisant; diversity / sufficiency short = donnees_insuffisantes; and the next engines wait", () => {
    const short = snap(170, "J+7", { integrity: { events: 120, bySource: { reseller_ui: 120 } } }, { activation: activation({ historyDays: 7 }) })
    const d = engineObservationDecisions(short, stableJ7(), j1())
    expect(d[0]!.status).toBe("historique_insuffisant")
    expect(d.slice(1).every((x) => x.status === "dependance_non_satisfaite")).toBe(true)
    const thin = snap(170, "J+7", { integrity: { events: 120, bySource: { reseller_ui: 120 } } }, { activation: activation({ missing: 4 }) })
    expect(engineObservationDecisions(thin, stableJ7(), j1())[0]!.status).toBe("donnees_insuffisantes")
  })
  it("a blocking anomaly overrides everything", () => {
    const bad = snap(170, "J+7", { integrity: { events: 120 }, catalog: { replicaDefaults: 2 } })
    expect(engineObservationDecisions(bad, stableJ7(), j1()).every((x) => x.status === "anomalie_bloquante")).toBe(true)
  })
})

describe("scripts — files only: no database, no network, nothing in the repository", () => {
  const env = { PATH: process.env.PATH ?? "", HOME: os.tmpdir() } as unknown as NodeJS.ProcessEnv
  it("the sources import no database client, no network call, no migration command", () => {
    for (const f of ["scripts/collection-snapshot.ts", "scripts/collection-compare.ts", "lib/launch-gate/collection-monitor.ts"]) {
      const s = readFileSync(path.join(process.cwd(), f), "utf8")
      expect(s).not.toMatch(/@prisma\/client|lib\/prisma"|PrismaClient|DATABASE_URL|fetch\(|https?:|schema:migrate|read-only-report|\$execute/)
    }
  })
  it("writes a sanitised snapshot OUTSIDE the repository (mode 600), refuses a folder inside it, compares two of them", () => {
    const work = mkdtempSync(path.join(os.tmpdir(), "collmon-"))
    const r0 = path.join(work, "r0.json")
    const r1 = path.join(work, "r1.json")
    writeFileSync(r0, JSON.stringify(report({ now: at(1), integrity: { events: 10, bySource: { reseller_ui: 10 } } })))
    writeFileSync(r1, JSON.stringify(report({ now: at(26), integrity: { events: 40, bySource: { reseller_ui: 40 } } })))
    const out = path.join(work, "snaps")
    const run = (args: string[]) => execFileSync("npx", ["tsx", ...args], { encoding: "utf8", env, timeout: 60_000 })
    run(["scripts/collection-snapshot.ts", "--readiness", r0, "--label", "etat_initial", "--out", out])
    run(["scripts/collection-snapshot.ts", "--readiness", r1, "--label", "J+1", "--out", out])
    const files = readdirSync(out).sort()
    expect(files).toHaveLength(2)
    expect(statSync(path.join(out, files[0]!)).mode & 0o777).toBe(0o600)
    const text = run(["scripts/collection-compare.ts", "--from", path.join(out, files[0]!), "--to", path.join(out, files[1]!)])
    expect(text).toMatch(/VOLUMES/)
    expect(() => run(["scripts/collection-snapshot.ts", "--readiness", r0, "--label", "J+1", "--out", path.join(process.cwd(), "tmp-snap")])).toThrow()
    expect(existsSync(path.join(process.cwd(), "tmp-snap"))).toBe(false)
  }, 120_000)
  it("a report without its destination is refused (no environment = no snapshot)", () => {
    const work = mkdtempSync(path.join(os.tmpdir(), "collmon-"))
    const f = path.join(work, "r.json")
    const r = report({ now: at(1) })
    delete (r as { target?: unknown }).target
    writeFileSync(f, JSON.stringify(r))
    expect(() => execFileSync("npx", ["tsx", "scripts/collection-snapshot.ts", "--readiness", f, "--label", "J+1", "--stdout"], { encoding: "utf8", env, timeout: 60_000, stdio: "pipe" })).toThrow()
  }, 60_000)
})

export type { CollectionSnapshot }
