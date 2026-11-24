/**
 * Historical data launch gate (founder brief 2026-11-24): one decision sheet, SEPARATE authorizations per step and per
 * engine, no automatic activation, UNKNOWN never shown as validated, production / unidentified destinations refused,
 * the four stop operations never confused, no secret printed, and the preparation tool executes nothing.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { buildPresenceReadinessReport, type PresenceReadinessReport } from "@/lib/listing-presence/integrity"
import { engineMaturity, REQUIRED_HISTORY_DAYS } from "@/lib/launch-gate/data-maturity"
import {
  buildLaunchDecisionSheet,
  ENGINE_OBSERVE_ORDER,
  evaluateStep,
  formatLaunchDecisionSheet,
  LAUNCH_STEPS,
  postStartCheck,
  readFlagStates,
  STOP_PROCEDURES,
  type Authorization,
  type Destination,
  type GateState,
} from "@/lib/launch-gate/launch-gate"
import { ACTIVATION_SEQUENCE, ENGINES, type ActivationReadinessReport } from "@/lib/reseller-copilot/activation-readiness"

const NOW = new Date("2026-11-24T12:00:00Z")
const STAGING: Destination = { endpoint: "ep-shy-wind-test", branch: "staging" }
const PROD: Destination = { endpoint: "ep-misty-sea-test", branch: "production" }
const auth = (over: Partial<Authorization>): Authorization => ({ step: "B", grantedBy: "fondateur", grantedAt: NOW, note: "décision écrite", ...over })
const state = (over: Partial<GateState> = {}): GateState => ({
  outcomes: { A: "fait" },
  engineModes: {},
  engineLevels: {},
  daysSinceCollection: null,
  checkpoints: { j1: null, j7: null },
  readinessGlobal: "WARN",
  ...over,
})

function staticReport(): PresenceReadinessReport {
  const dir = path.join(process.cwd(), "prisma/migrations/20261124090000_listing_presence_history/migration.sql")
  const rb = path.join(process.cwd(), "scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql")
  return buildPresenceReadinessReport({
    now: NOW,
    staticFacts: { migrationFilePresent: true, migrationSql: readFileSync(dir, "utf8"), rollbackSql: readFileSync(rb, "utf8") },
    catalog: null,
    integrity: null,
    volumes: null,
    engines: null,
    databaseNotReadReason: "test",
  })
}

describe("destinations — production and unidentified refused for B / C", () => {
  it("B refuses production, unknown and local; accepts the named staging only with its own authorization", () => {
    for (const d of [PROD, { endpoint: "x", branch: "unknown" } as Destination, { endpoint: "l", branch: "local" } as Destination]) {
      expect(evaluateStep("B", { destination: d, auths: [auth({ endpoint: d.endpoint })], state: state() }).allowed).toBe(false)
    }
    expect(evaluateStep("B", { destination: null, auths: [], state: state() }).reasons).toContain("destination non fournie")
    expect(evaluateStep("B", { destination: STAGING, auths: [], state: state() }).allowed).toBe(false) // no authorization
    expect(evaluateStep("B", { destination: STAGING, auths: [auth({ endpoint: "ep-other" })], state: state() }).allowed).toBe(false) // another endpoint
    expect(evaluateStep("B", { destination: STAGING, auths: [auth({ endpoint: STAGING.endpoint, note: " " })], state: state() }).allowed).toBe(false) // no reason
    const ok = evaluateStep("B", { destination: STAGING, auths: [auth({ endpoint: STAGING.endpoint })], state: state() })
    expect(ok).toMatchObject({ allowed: true, executesAutomatically: false })
  })
  it("B is refused while the readiness report is BLOCKED, and without step A", () => {
    const a = [auth({ endpoint: STAGING.endpoint })]
    expect(evaluateStep("B", { destination: STAGING, auths: a, state: state({ readinessGlobal: "BLOCKED" }) }).allowed).toBe(false)
    expect(evaluateStep("B", { destination: STAGING, auths: a, state: state({ outcomes: {} }) }).allowed).toBe(false)
  })
})

describe("separate authorizations — none stands in for another", () => {
  it("a B authorization never allows C or D; D needs its own, naming production", () => {
    const st = state({ outcomes: { A: "fait", B: "fait", C: "fait" }, readinessGlobal: "PASS" })
    const bOnly = [auth({ step: "B", endpoint: STAGING.endpoint })]
    expect(evaluateStep("C", { destination: STAGING, auths: bOnly, state: st }).allowed).toBe(false)
    expect(evaluateStep("D", { destination: PROD, auths: bOnly, state: st }).allowed).toBe(false)
    expect(evaluateStep("D", { destination: PROD, auths: [auth({ step: "D", endpoint: STAGING.endpoint })], state: st }).allowed).toBe(false)
    expect(evaluateStep("D", { destination: STAGING, auths: [auth({ step: "D", endpoint: STAGING.endpoint })], state: st }).allowed).toBe(false)
    expect(evaluateStep("D", { destination: PROD, auths: [auth({ step: "D", endpoint: PROD.endpoint })], state: st }).allowed).toBe(true)
  })
  it("D requires C done and a readiness PASS/WARN — UNKNOWN is never read as validated", () => {
    const a = [auth({ step: "D", endpoint: PROD.endpoint })]
    expect(evaluateStep("D", { destination: PROD, auths: a, state: state({ outcomes: { A: "fait", B: "fait" }, readinessGlobal: "PASS" }) }).allowed).toBe(false)
    const unknown = evaluateStep("D", { destination: PROD, auths: a, state: state({ outcomes: { A: "fait", B: "fait", C: "fait" }, readinessGlobal: "UNKNOWN" }) })
    expect(unknown.allowed).toBe(false)
    expect(unknown.reasons.join(" ")).toMatch(/UNKNOWN/)
  })
  it("an E authorization never allows F; F needs level 4, observe first and a control group for reseller-facing engines", () => {
    const st = state({ outcomes: { A: "fait", B: "fait", C: "fait", D: "fait" }, engineModes: { observation_plan: "observe" }, engineLevels: { observation_plan: 4 }, holdoutPct: { observation_plan: 10 } })
    expect(evaluateStep("F", { engine: "observation_plan", auths: [auth({ step: "E", engine: "observation_plan" })], state: st }).allowed).toBe(false)
    expect(evaluateStep("F", { engine: "observation_plan", auths: [auth({ step: "F", engine: "retention" })], state: st }).allowed).toBe(false)
    expect(evaluateStep("F", { engine: "observation_plan", auths: [auth({ step: "F", engine: "observation_plan" })], state: st }).allowed).toBe(true)
    expect(evaluateStep("F", { engine: "observation_plan", auths: [auth({ step: "F", engine: "observation_plan" })], state: { ...st, holdoutPct: {} } }).allowed).toBe(false)
    expect(evaluateStep("F", { engine: "observation_plan", auths: [auth({ step: "F", engine: "observation_plan" })], state: { ...st, engineLevels: { observation_plan: 3 } } }).allowed).toBe(false)
    // The contextual horizon reaches resellers through the plan: the plan must be ON with its control group.
    const ctx = { ...st, engineModes: { contextual_horizon: "observe" as const, observation_plan: "observe" as const }, engineLevels: { contextual_horizon: 4 } }
    expect(evaluateStep("F", { engine: "contextual_horizon", auths: [auth({ step: "F", engine: "contextual_horizon" })], state: ctx }).reasons.join(" ")).toMatch(/observation_plan/)
  })
})

describe("no automatic activation, dependency order respected", () => {
  it("the observe order is the documented sequence's, never re-written", () => {
    const fromSeq = ACTIVATION_SEQUENCE.filter((s) => s.order >= 1 && s.order <= 5).map((s) => ENGINES.find((e) => e.flag === s.flag)!.id)
    expect(ENGINE_OBSERVE_ORDER).toEqual(fromSeq)
    expect(ENGINE_OBSERVE_ORDER).toHaveLength(5)
  })
  it("an engine can not go to observe before the ones it depends on, even when authorized", () => {
    const st = state({ outcomes: { A: "fait", B: "fait", C: "fait", D: "fait" }, checkpoints: { j1: "PASS", j7: "PASS" }, engineLevels: { retention: 3, temporal: 3 } })
    const r = evaluateStep("E", { engine: "retention", auths: [auth({ step: "E", engine: "retention" })], state: st })
    expect(r.allowed).toBe(false)
    expect(r.reasons.join(" ")).toMatch(/temporal doit être en observation/)
    expect(evaluateStep("E", { engine: "temporal", auths: [auth({ step: "E", engine: "temporal" })], state: st }).allowed).toBe(true)
  })
  it("E is refused before the J+7 check of the collection, and with an UNKNOWN check", () => {
    const st = state({ outcomes: { A: "fait", B: "fait", C: "fait", D: "fait" }, engineLevels: { temporal: 3 } })
    const a = [auth({ step: "E", engine: "temporal" })]
    expect(evaluateStep("E", { engine: "temporal", auths: a, state: st }).allowed).toBe(false)
    expect(evaluateStep("E", { engine: "temporal", auths: a, state: { ...st, checkpoints: { j1: "PASS", j7: "UNKNOWN" } } }).allowed).toBe(false)
  })
  it("every decision carries executesAutomatically: false, and success of every step still authorizes nothing", () => {
    const done = state({ outcomes: { A: "fait", B: "fait", C: "fait", D: "fait", E: "fait", F: "fait" }, readinessGlobal: "PASS", checkpoints: { j1: "PASS", j7: "PASS" }, engineLevels: Object.fromEntries(ENGINES.map((e) => [e.id, 5])), engineModes: Object.fromEntries(ENGINES.map((e) => [e.id, "observe"])) })
    for (const s of ["B", "C", "D"] as const) expect(evaluateStep(s, { destination: s === "D" ? PROD : STAGING, auths: [], state: done }).allowed).toBe(false)
    for (const e of ENGINES) {
      expect(evaluateStep("E", { engine: e.id, auths: [], state: done }).allowed).toBe(false)
      const f = evaluateStep("F", { engine: e.id, auths: [], state: done })
      expect(f.allowed).toBe(false)
      expect(f.executesAutomatically).toBe(false)
    }
  })
})

describe("stops — four distinct operations, losses said", () => {
  it("rollback of the migration and data restore are lossy; engine off and collection stop are not; no step uses restore", () => {
    expect(STOP_PROCEDURES.rollback_migration.losesCollectedData).toBe(true)
    expect(STOP_PROCEDURES.restauration_donnees.losesCollectedData).toBe(true)
    expect(STOP_PROCEDURES.desactivation_moteur.losesCollectedData).toBe(false)
    expect(STOP_PROCEDURES.arret_collecte.losesCollectedData).toBe(false)
    expect(STOP_PROCEDURES.arret_collecte.dataAffected).toMatch(/trou définitif/)
    expect(LAUNCH_STEPS.map((s) => s.stop)).not.toContain("restauration_donnees")
    // Once production collects (D), the step's stop is NOT the lossy rollback.
    expect(LAUNCH_STEPS.find((s) => s.id === "D")!.stop).toBe("arret_collecte")
    expect(LAUNCH_STEPS.find((s) => s.id === "E")!.stop).toBe("desactivation_moteur")
  })
  it("the rollback script the procedure names exists", () => {
    expect(readFileSync(path.join(process.cwd(), "scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql"), "utf8")).toMatch(/DROP/i)
  })
})

describe("post-start checks — UNKNOWN when nothing was read", () => {
  it("no report = UNKNOWN; a static report (database not read) is never PASS", () => {
    expect(postStartCheck("J+1", null).status).toBe("UNKNOWN")
    expect(postStartCheck("J+7", staticReport()).status).not.toBe("PASS")
  })
  it("no listing with history at J+7 = BLOCKED (the capture recorded nothing)", () => {
    const r = { ...staticReport(), global: "PASS" as const, checks: [], volumes: { listingsWithHistory: 0, products: 0, resellers: 0, completePeriods: 0, ongoingPeriods: 0, unjudgedPeriods: 0, periodsWithSale: 0, censoredPeriods: 0, historyDays: 7 } }
    expect(postStartCheck("J+7", r).status).toBe("BLOCKED")
    expect(postStartCheck("J+1", r).status).toBe("WARN")
  })
})

describe("the sheet — classified evidence, no secret, executes nothing", () => {
  const sheet = () =>
    buildLaunchDecisionSheet({
      now: NOW,
      git: { branch: "release/x", head: "759de119b1a9", remoteHead: "759de119b1a9", clean: true },
      readiness: staticReport(),
      readinessFromFile: false,
      activation: null,
      flags: readFlagStates({}),
      state: state({ readinessGlobal: staticReport().global }),
      auths: [],
    })
  it("database facts not read are INCONNUS, never verified; decisions listed; every step refused except A", () => {
    const s = sheet()
    expect(s.executesNothing).toBe(true)
    const unknown = s.evidence.filter((e) => e.kind === "inconnu").map((e) => e.topic)
    expect(unknown.some((t) => t.includes("A4_migration_applied"))).toBe(true)
    expect(unknown).toContain("base")
    expect(s.evidence.filter((e) => e.kind === "fait_verifie").some((e) => e.topic.includes("A4"))).toBe(false)
    expect(s.evidence.filter((e) => e.kind === "decision").map((e) => e.topic)).toEqual(["B", "D", "E/F"])
    expect(s.steps.filter((x) => x.decision.allowed).map((x) => x.id)).toEqual(["A"])
    expect(s.engines.every((e) => !e.observe.allowed && !e.activate.allowed)).toBe(true)
  })
  it("no secret: flags are normalised, a planted URL or key never appears", () => {
    const planted = { COPILOT_TEMPORAL_MODE: "postgres://user:SECRETPASS@host/db", OBSERVATION_PLAN_HOLDOUT_PCT: "sk_live_SECRET", RETENTION_ADVISOR_MODE: "observe" }
    const f = readFlagStates(planted)
    expect(JSON.stringify(f)).not.toMatch(/SECRET|postgres|sk_live/)
    expect(f.RETENTION_ADVISOR_MODE).toBe("observe")
    const text = formatLaunchDecisionSheet({ ...sheet(), flags: f })
    expect(text).not.toMatch(/SECRET|postgres:\/\/|sk_live/)
  })
  it("the script connects to nothing: no database client, no network client, no migration command", () => {
    const src = readFileSync(path.join(process.cwd(), "scripts/report-launch-gate.ts"), "utf8")
    expect(src).not.toMatch(/@prisma\/client|lib\/prisma"|PrismaClient|DATABASE_URL|fetch\(|schema-deploy|schema:migrate|"migrate"|read-only-report|\$execute/)
    for (const f of ["lib/launch-gate/launch-gate.ts", "lib/launch-gate/data-maturity.ts"]) {
      const s = readFileSync(path.join(process.cwd(), f), "utf8")
      expect(s).not.toMatch(/from "@\/lib\/prisma"|\.server"|process\.env|execFileSync|fetch\(/)
    }
  })
  it("running the script in preparation mode prints the sheet and changes nothing in the repository", () => {
    const before = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
    const out = execFileSync("npx", ["tsx", "scripts/report-launch-gate.ts"], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as NodeJS.ProcessEnv, timeout: 60_000 })
    expect(out).toMatch(/Cet outil n'exécute rien/)
    expect(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })).toBe(before)
  }, 70_000)
})

describe("data maturity — collected is not sufficient; unknown never ok", () => {
  const activation = (over: Partial<ActivationReadinessReport["data"]> = {}, level = 2, missing = 5): ActivationReadinessReport =>
    ({
      generatedAt: NOW.toISOString(),
      migrationApplied: true,
      trackingStartedAt: null,
      data: { historyDays: 20, coversBlindSpotWindow: false, periods: 100, unjudgedPeriods: 5, censoredShare: 0.3, products: 40, resellers: 8, firstSales: 30, resellersWithSale: 6, fullyFollowedSales: 0, fullyFollowedResellers: 0, salesCadencePerDay: 1, productsAtProductTier: 0, productsAtJudgingFloors: 0, unattributedShare: 0, ...over },
      engines: ENGINES.map((e) => ({ id: e.id, name: e.name, flag: e.flag, mode: "off", dimensions: { technique: 2, donnees: 2, statistique: 2, securite: 2 }, level, levelLabel: "", state: "collecte", mainDependency: "", gaps: [{ metric: "x", required: 10, available: 10 - missing, missing }], resellersRequired: 5, resellersMissing: 0, etaDays: null, etaBasis: "", risk: "faible", exitConditions: [], nextAction: "", testsNeeded: [] })),
      sequence: [],
      checklist: [],
      limits: [],
    }) as unknown as ActivationReadinessReport

  it("nothing read = every dimension unknown, verdict non_demarrable", () => {
    const m = engineMaturity("temporal", { now: NOW, readiness: null, activation: null, lastEventAt: null, previous: null })
    expect(m.verdict).toBe("non_demarrable")
    expect(m.dimensions.every((x) => x.value === "inconnu")).toBe(true)
  })
  it("startable with collected data but gaps open = demarrable_donnees_insuffisantes", () => {
    const m = engineMaturity("temporal", { now: NOW, readiness: null, activation: activation(), lastEventAt: new Date(NOW.getTime() - 3_600_000), previous: null })
    expect(m.verdict).toBe("demarrable_donnees_insuffisantes")
    expect(m.dimensions.find((d) => d.id === "suffisance")!.value).toBe("insuffisant")
    expect(m.dimensions.find((d) => d.id === "fraicheur")!.value).toBe("satisfaisant")
  })
  it("the contextual engine needs two followed halves; history shorter = insufficient coverage", () => {
    expect(REQUIRED_HISTORY_DAYS.contextual_horizon).toBe(180)
    const m = engineMaturity("contextual_horizon", { now: NOW, readiness: null, activation: activation({ historyDays: 120 }), lastEventAt: NOW, previous: null })
    expect(m.dimensions.find((d) => d.id === "couverture_temporelle")!.value).toBe("insuffisant")
  })
  it("stability needs two readings; volumes going backwards are flagged", () => {
    const a = activation({}, 3, 0)
    const lone = engineMaturity("temporal", { now: NOW, readiness: null, activation: a, lastEventAt: NOW, previous: null })
    expect(lone.dimensions.find((d) => d.id === "stabilite")!.value).toBe("inconnu")
    const back = engineMaturity("temporal", { now: NOW, readiness: null, activation: a, lastEventAt: NOW, previous: activation({ periods: 200 }, 3, 0) })
    expect(back.dimensions.find((d) => d.id === "stabilite")!.value).toBe("insuffisant")
  })
  it("unattributed events make provenance insufficient", () => {
    const m = engineMaturity("temporal", { now: NOW, readiness: null, activation: activation({ unattributedShare: 0.02 }), lastEventAt: NOW, previous: null })
    expect(m.dimensions.find((d) => d.id === "provenance")!.value).toBe("insuffisant")
  })
})
