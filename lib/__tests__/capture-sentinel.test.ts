/**
 * Capture Sentinel — pure rules and runner contract (no database, no network). The real-PostgreSQL proof is
 * `capture-sentinel-db.test.ts` (CI job « Money-path tests on a real PostgreSQL »).
 *
 * Kind of test, said per block: [unitaire] pure functions; [simulé] the runner with a fake client.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  SENTINEL_ID_PREFIX,
  SENTINEL_SOURCE,
  SENTINEL_STEPS,
  SENTINEL_VALIDITY_HOURS,
  captureProofLabel,
  decideSentinelDestination,
  evaluateSentinel,
  sentinelForSnapshot,
  sentinelIds,
  type ObservedEvent,
  type SentinelEnvironment,
  type SentinelObservations,
  type SentinelResult,
} from "@/lib/listing-presence/capture-sentinel"
import { cleanupSentinelResidue, runCaptureSentinel } from "@/lib/listing-presence/capture-sentinel-run"
import { assessStability, buildCollectionSnapshot, compareSnapshots, detectAnomalies, engineObservationDecisions, type CollectionSnapshot } from "@/lib/launch-gate/collection-monitor"
import { LISTING_PRESENCE_SOURCES } from "@/lib/listing-presence/sources"
import { withdrawalReason } from "@/lib/reseller-copilot/temporal-opportunities"

const LOCAL = "postgresql://postgres@127.0.0.1:5432/affisell_test"
const ENV_LOCAL: SentinelEnvironment = { kind: "local", branch: "local", endpoint: "non_identifie" }
const ids = sentinelIds("t1")

describe("[unitaire] destination — decided BEFORE any connection; ambiguity = refusal", () => {
  const d = (url: string | undefined, env: Record<string, string | undefined> = {}, protectedUrls: string[] = []) => decideSentinelDestination({ url, protectedUrls, env })
  it("a disposable local test database is accepted (local, or ci under GitHub Actions)", () => {
    expect(d(LOCAL)).toEqual({ allowed: true, environment: ENV_LOCAL })
    expect(d(LOCAL, { CI: "true", GITHUB_ACTIONS: "true" })).toMatchObject({ allowed: true, environment: { kind: "ci" } })
    expect(d("postgres://u:p@localhost/sentinel_tmp")).toMatchObject({ allowed: true })
  })
  it("production is refused (15)", () => {
    expect(d("postgresql://u:p@ep-misty-sea-al1ne07p.eu-central-1.aws.neon.tech/neondb")).toMatchObject({ allowed: false, code: "production" })
  })
  it("staging is recognised and refused: the staging variant is prepared, not enabled (16)", () => {
    expect(d("postgresql://u:p@ep-shy-wind-abc123.eu-central-1.aws.neon.tech/neondb")).toMatchObject({ allowed: false, code: "staging_non_active" })
  })
  it("an unknown destination is refused (14): remote host, Vercel, persistent local base, protected base, unreadable, absent", () => {
    expect(d("postgresql://u:p@ep-other-xyz.aws.neon.tech/affisell_test")).toMatchObject({ allowed: false, code: "distante_non_identifiee" })
    expect(d("postgresql://u:p@db.example.com/affisell_test")).toMatchObject({ allowed: false, code: "distante_non_identifiee" })
    expect(d(LOCAL, { VERCEL: "1" })).toMatchObject({ allowed: false, code: "deploiement_vercel" })
    expect(d("postgresql://postgres@127.0.0.1:5432/affisell")).toMatchObject({ allowed: false, code: "base_locale_non_jetable" })
    expect(d(LOCAL, {}, [LOCAL])).toMatchObject({ allowed: false, code: "base_protegee" })
    expect(d("mysql://localhost/test")).toMatchObject({ allowed: false, code: "url_illisible" })
    expect(d(undefined)).toMatchObject({ allowed: false, code: "url_absente" })
  })
  it("a refusal never contains the URL", () => {
    const r = d("postgresql://user:s3cr3t@ep-misty-sea-al1ne07p.aws.neon.tech/neondb")
    expect(JSON.stringify(r)).not.toMatch(/s3cr3t|neon\.tech|postgresql:/)
  })
})

describe("[simulé] runner — no connection unless allowed (17), nothing executes automatically", () => {
  it("a refused destination returns NOT_RUN and never calls connect", async () => {
    const connect = vi.fn()
    for (const url of ["postgresql://u@ep-misty-sea-x.aws.neon.tech/db", "postgresql://u@ep-shy-wind-x.aws.neon.tech/db", "postgresql://u@10.0.0.1/affisell_test"]) {
      const r = await runCaptureSentinel({ destination: decideSentinelDestination({ url, protectedUrls: [], env: {} }), connect })
      expect(r.overall).toBe("NOT_RUN")
      expect(r.refusal).toBeTruthy()
      expect(r.executesAutomatically).toBe(false)
    }
    const c = await cleanupSentinelResidue({ destination: decideSentinelDestination({ url: "postgresql://u@ep-misty-sea-x.aws.neon.tech/db", protectedUrls: [], env: {} }), connect })
    expect(c.done).toBe(false)
    expect(connect).not.toHaveBeenCalled()
  })
  it("a database without the history table: NOT_RUN « historique absent », no transaction opened", async () => {
    const client = { $queryRaw: vi.fn(async () => [{ t: null }]), $transaction: vi.fn() }
    const r = await runCaptureSentinel({ destination: { allowed: true, environment: ENV_LOCAL }, connect: () => client })
    expect(r.overall).toBe("NOT_RUN")
    expect(r.refusal).toMatch(/historique_absent/)
    expect(client.$transaction).not.toHaveBeenCalled()
  })
  it("the modules make no network call and read no engine flag (20)", () => {
    for (const f of ["capture-sentinel.ts", "capture-sentinel-run.ts"]) {
      const src = readFileSync(path.join(process.cwd(), "lib/listing-presence", f), "utf8")
      expect(src).not.toMatch(/\bfetch\(|https?:\/\/|_MODE\b|process\.env/)
    }
  })
})

// ── Evaluation of observations ────────────────────────────────────────────────────────────────────────────────────

const T0 = Date.parse("2026-11-24T12:00:00.000Z")
const at = (ms: number) => new Date(T0 + ms).toISOString()
const ev = (kind: string, p: boolean | null, n: boolean | null, ms: number, over: Partial<ObservedEvent> = {}): ObservedEvent => ({
  kind, previousListed: p, newListed: n, source: SENTINEL_SOURCE, actorId: ids.actorId, affiliateProductId: ids.listingId, affiliateId: ids.affiliateId, productId: ids.productId, effectiveAt: at(ms), ...over,
})

function goodObs(): SentinelObservations {
  return {
    takenAt: at(0), historyTableExists: true, setup: "ok", listingGoneInTransaction: true, ending: "rolled_back",
    residue: { listings: 0, events: 0, products: 0, users: 0, priceRows: 0 },
    steps: [
      { id: "create", mutation: "ok", before: at(0), after: at(10), events: [ev("created", null, false, 5)] },
      { id: "list", mutation: "ok", before: at(20), after: at(30), events: [ev("listed", false, true, 25)] },
      { id: "noop", mutation: "ok", before: at(40), after: at(50), events: [] },
      { id: "unlist", mutation: "ok", before: at(60), after: at(70), events: [ev("unlisted", true, false, 65)] },
      { id: "delete", mutation: "ok", before: at(80), after: at(90), events: [ev("deleted", false, null, 85)] },
    ],
  }
}
const run = (o: SentinelObservations) => evaluateSentinel(o, ids, ENV_LOCAL)
const check = (r: SentinelResult, id: string) => r.checks.find((c) => c.id === id)!

describe("[unitaire] evaluation — every step proved by the EVENT read back", () => {
  it("mutation + matching event, provenance, UTC, chain, final state, rollback, isolation: PASS (1–5)", () => {
    const r = run(goodObs())
    expect(r.overall).toBe("PASS")
    expect(r.checks.every((c) => c.status === "PASS")).toBe(true)
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(["provenance", "utc", "chaine", "etat_final", "annulation", "isolation", "identification", "evenement:noop"]))
    expect(r.captureDelayMsMax).toBe(5)
    expect(SENTINEL_STEPS).toHaveLength(5)
  })
  it("missing event → FAIL « événement absent » (6)", () => {
    const o = goodObs()
    o.steps[1]!.events = []
    expect(check(run(o), "evenement:list")).toMatchObject({ status: "FAIL", detail: expect.stringMatching(/absent/) })
    expect(run(o).overall).toBe("FAIL")
  })
  it("incorrect event → FAIL (7): wrong kind, wrong listing", () => {
    const o = goodObs()
    o.steps[1]!.events = [ev("unlisted", false, true, 25)]
    expect(check(run(o), "evenement:list").detail).toMatch(/incorrect/)
    const o2 = goodObs()
    o2.steps[3]!.events = [ev("unlisted", true, false, 65, { affiliateId: "someone-else" })]
    expect(check(run(o2), "evenement:unlist").status).toBe("FAIL")
    expect(check(run(o2), "identification").status).toBe("FAIL")
  })
  it("duplicate → FAIL (8); an event for an unchanged save → FAIL idempotence (5)", () => {
    const o = goodObs()
    o.steps[0]!.events = [ev("created", null, false, 5), ev("created", null, false, 6)]
    expect(check(run(o), "evenement:create").detail).toMatch(/doublon/)
    const o2 = goodObs()
    o2.steps[2]!.events = [ev("listed", true, true, 45)]
    expect(check(run(o2), "evenement:noop")).toMatchObject({ status: "FAIL", detail: expect.stringMatching(/parasite/) })
  })
  it("provenance: another source or actor → FAIL (2)", () => {
    const o = goodObs()
    o.steps[1]!.events = [ev("listed", false, true, 25, { source: "unattributed" })]
    expect(check(run(o), "provenance").status).toBe("FAIL")
  })
  it("UTC: an event 13 h off its mutation window → FAIL (3)", () => {
    const o = goodObs()
    o.steps[1]!.events = [ev("listed", false, true, 25 + 13 * 3_600_000)]
    expect(check(run(o), "utc")).toMatchObject({ status: "FAIL", detail: expect.stringMatching(/13 h/) })
  })
  it("failed mutation (9): FAIL, no event expected, later steps NOT_RUN, still isolated", () => {
    const o = goodObs()
    o.steps = [o.steps[0]!, { id: "list", mutation: "failed", before: at(20), after: null, events: [] }]
    o.listingGoneInTransaction = null
    const r = run(o)
    expect(r.overall).toBe("FAIL")
    expect(check(r, "mutation:list").status).toBe("FAIL")
    expect(check(r, "evenement:list").status).toBe("PASS")
    expect(check(r, "mutation:unlist").status).toBe("NOT_RUN")
    expect(check(r, "isolation").status).toBe("PASS")
  })
  it("interrupted transaction → never PASS (UNKNOWN), residue still judged (12)", () => {
    const o = goodObs()
    o.steps = o.steps.slice(0, 2)
    o.ending = "interrupted"
    o.listingGoneInTransaction = null
    const r = run(o)
    expect(r.overall).toBe("UNKNOWN")
    expect(check(r, "annulation").status).toBe("UNKNOWN")
    expect(check(r, "mutation:unlist").status).toBe("UNKNOWN")
  })
  it("residue after the transaction → isolation FAIL (4, 11)", () => {
    const o = goodObs()
    o.residue = { listings: 1, events: 2, products: 0, users: 0, priceRows: 0 }
    expect(check(run(o), "isolation")).toMatchObject({ status: "FAIL", detail: expect.stringMatching(/listings=1/) })
  })
})

describe("[unitaire] the sentinel source is known, readable, and never a commercial actor", () => {
  it("declared source, engines read it as technical", () => {
    expect(LISTING_PRESENCE_SOURCES).toContain(SENTINEL_SOURCE)
    expect(withdrawalReason(SENTINEL_SOURCE)).toBe("technique")
    expect(ids.listingId.startsWith(SENTINEL_ID_PREFIX)).toBe(true)
    expect(ids.actorId).toMatch(/^[A-Za-z0-9_:-]{1,64}$/)
  })
})

// ── Collection monitor ───────────────────────────────────────────────────────────────────────────────────────────

const STAGING = { branch: "staging" as const, endpoint: "ep-shy-wind-abc123" }
function probe(overall: SentinelResult["overall"], takenAt: string, env: SentinelEnvironment = { kind: "staging", ...STAGING }): SentinelResult {
  const base = run(goodObs())
  return { ...base, takenAt, environment: env, overall, checks: overall === "FAIL" ? [{ id: "evenement:list", status: "FAIL", detail: "x" }] : base.checks }
}
function snap(takenAt: string, events: number, sentinel: SentinelResult | null, label: "etat_initial" | "J+1" | "J+7" = "J+1"): CollectionSnapshot {
  const readiness = {
    generatedAt: takenAt, global: "PASS", checks: [{ id: "B_capture", section: "B", status: "PASS", critical: true, executed: true }],
    volumes: { listingsWithHistory: 2, products: 1, resellers: 1, completePeriods: 1, ongoingPeriods: 1, unjudgedPeriods: 0, periodsWithSale: 0, censoredPeriods: 0, historyDays: 2 },
    target: STAGING,
    facts: {
      migrationRow: "applied", migrationFinishedAt: "2026-11-20T00:00:00.000Z", tableExists: true,
      triggers: [{ name: "AffiliateProduct_listing_presence_history", enabled: "O", defects: 0 }],
      sessionReplicationRole: "origin", replicaDefaults: 0, roleOwnsTable: false, roleHasTruncate: false,
      integrity: { events, byKind: { created: events }, bySource: { reseller_ui: events }, newestEventAt: "2026-11-20T01:00:00.000Z", truncated: false, stateMismatches: 0, createdWithoutEvent: 0, deletedButPresent: 0, chainBreaks: 0, duplicates: 0 },
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buildCollectionSnapshot({ readiness: readiness as any, appCommit: "e67a48f42", takenAt: new Date(takenAt), label, sentinel })
}

describe("[unitaire] collection monitor integration (19) — proof of capture, never more", () => {
  const T = "2026-11-21T06:00:00.000Z"
  it("statuses: confirmed, failed, expired, not run, environment not verified", () => {
    const s = { takenAt: T, environment: STAGING }
    expect(sentinelForSnapshot(probe("PASS", "2026-11-21T05:00:00.000Z"), s).status).toBe("confirmee")
    expect(sentinelForSnapshot(probe("FAIL", "2026-11-21T05:00:00.000Z"), s).status).toBe("echouee")
    expect(sentinelForSnapshot(probe("UNKNOWN", "2026-11-21T05:00:00.000Z"), s).status).toBe("inconcluante")
    expect(sentinelForSnapshot(probe("PASS", `2026-11-20T${String(23 - SENTINEL_VALIDITY_HOURS).padStart(2, "0")}:00:00.000Z`), s).status).toBe("expiree") // 13 (stale probe)
    expect(sentinelForSnapshot(null, s).status).toBe("non_executee")
    // A local / CI probe never vouches for a staging snapshot.
    expect(sentinelForSnapshot(probe("PASS", "2026-11-21T05:00:00.000Z", ENV_LOCAL), s).status).toBe("environnement_non_verifie")
    expect(sentinelForSnapshot(probe("PASS", "2026-11-21T05:00:00.000Z"), { takenAt: T, environment: { branch: "staging", endpoint: "non_identifie" } }).status).toBe("environnement_non_verifie")
  })
  it("labels distinguish « confirmée par sonde » from « fonctionnelle mais non testée récemment »", () => {
    expect(captureProofLabel({ status: "confirmee" } as never, true)).toMatch(/confirmée par sonde/)
    expect(captureProofLabel({ status: "expiree" } as never, true)).toMatch(/non testée récemment/)
    expect(captureProofLabel(null, true)).toMatch(/non testée récemment/)
  })
  it("a failed probe is a BLOCKING anomaly: J+1 unstable, every engine blocked, none executes (19, 20)", () => {
    const base = snap("2026-11-20T00:30:00.000Z", 10, null, "etat_initial")
    const cur = snap(T, 20, probe("FAIL", "2026-11-21T05:30:00.000Z"))
    expect(cur.anomalies.find((a) => a.code === "sonde_echouee")?.severity).toBe("bloquant")
    expect(assessStability("J+1", base, cur).verdict).toBe("instable")
    const decisions = engineObservationDecisions(cur, null)
    expect(decisions.every((d) => d.status === "anomalie_bloquante" && d.executesAutomatically === false)).toBe(true)
  })
  it("a quiet window: without a probe « preuve insuffisante », with a confirmed probe the capture is proved (19)", () => {
    const base = snap("2026-11-20T00:30:00.000Z", 10, null, "etat_initial")
    const quiet = snap(T, 10, null)
    const v1 = assessStability("J+1", base, quiet)
    expect(v1.verdict).toBe("preuve_insuffisante")
    const proved = snap(T, 10, probe("PASS", "2026-11-21T05:45:00.000Z"))
    const v2 = assessStability("J+1", base, proved)
    expect(v2.criteria.find((c) => c.criterion === "nouveaux_evenements")?.met).toBe(true)
    expect(v2.criteria.find((c) => c.criterion === "sonde_de_capture")?.met).toBe(true)
    expect(v2.verdict, JSON.stringify(v2.criteria.filter((c) => c.met !== true))).toBe("stable")
    // The ambiguity anomaly is kept, as information — the probe settles it, it does not hide it.
    const quietAnomaly = detectAnomalies(proved, base).find((a) => a.code === "aucun_nouvel_evenement")
    expect(quietAnomaly?.severity).toBe("info")
    expect(quietAnomaly?.explanation).toMatch(/activité calme/)
  })
  it("an absent or expired probe never weakens a window with real events; a probe does not change the eight dimensions", () => {
    const base = snap("2026-11-20T00:30:00.000Z", 10, null, "etat_initial")
    const withEvents = snap(T, 30, null)
    const expired = snap(T, 30, probe("PASS", "2026-11-20T10:00:00.000Z"))
    expect(assessStability("J+1", base, withEvents).verdict).toBe(assessStability("J+1", base, expired).verdict)
    const c1 = compareSnapshots(base, withEvents)
    const c2 = compareSnapshots(base, snap(T, 30, probe("PASS", "2026-11-21T05:45:00.000Z")))
    if (!c1.comparable || !c2.comparable) throw new Error("comparable expected")
    expect(c2.dimensions).toEqual(c1.dimensions)
    expect(c2.captureProof).toMatch(/confirmée par sonde/)
    expect(c1.captureProof).toMatch(/non testée récemment/)
  })
  it("sentinel residue in the facts is a blocking anomaly (11)", () => {
    const s = snap(T, 10, null)
    const withResidue = { ...s, integrity: { ...s.integrity!, bySource: { ...s.integrity!.bySource, capture_sentinel: 3 } } }
    expect(detectAnomalies(withResidue).find((a) => a.code === "residu_de_sonde")?.severity).toBe("bloquant")
  })
  it("a snapshot with a probe stays clean (no URL, id or secret)", () => {
    const s = snap(T, 10, probe("PASS", "2026-11-21T05:45:00.000Z"))
    expect(JSON.stringify(s)).not.toMatch(/capture-sentinel-|sentinel:|@|:\/\//)
  })
})
