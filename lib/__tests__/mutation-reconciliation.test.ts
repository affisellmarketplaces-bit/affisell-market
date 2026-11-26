/**
 * Mutation / history reconciliation — pure rules [unitaire] and Collection Monitor integration [unitaire].
 * The real-PostgreSQL proof (a disabled trigger really produces confirmed losses) is `mutation-reconciliation-db.test.ts`.
 */
import { describe, expect, it } from "vitest"

import { assessStability, buildCollectionSnapshot, compareSnapshots, engineObservationDecisions, type CollectionSnapshot } from "@/lib/launch-gate/collection-monitor"
import { reconciliationCheck, type IntegrityFacts } from "@/lib/listing-presence/integrity"
import { LISTING_MUTATION_REGISTRY } from "@/lib/listing-presence/mutation-registry"
import {
  AUDIT_WITNESS_SOURCES,
  CLOCK_MARGIN_NON_UTC_MS,
  RATE_MIN_DENOMINATOR,
  reconcileMutations,
  reconciliationFacts,
  registrySourcesFor,
  type RecEvent,
  type ReconciliationInput,
} from "@/lib/listing-presence/reconciliation"
import { LISTING_PRESENCE_SOURCES } from "@/lib/listing-presence/sources"

const START = new Date("2026-11-20T00:00:00.000Z")
const H = 3_600_000
const at = (h: number) => new Date(START.getTime() + h * H)
const ev = (listingId: string, kind: RecEvent["kind"], p: boolean | null, n: boolean | null, h: number, source = "listing_create"): RecEvent => ({ listingId, kind, previousListed: p, newListed: n, source, effectiveAt: at(h) })

function input(over: Partial<ReconciliationInput> = {}): ReconciliationInput {
  return {
    now: at(72), trackingStart: START, clockMarginMs: 0,
    events: { rows: [], truncated: false }, listings: null, creations: { rows: [], truncated: false }, audits: { rows: [], truncated: false },
    integrity: null, ...over,
  }
}
const cls = (r: ReturnType<typeof reconcileMutations>, c: string) => r.classes.find((x) => x.witnessClass === c)!

describe("[unitaire] the witnesses reuse the provenance registry, never a copy", () => {
  it("every audit witness names a registered path, and the creation sources are known presence sources", () => {
    for (const key of Object.values(AUDIT_WITNESS_SOURCES)) expect(LISTING_MUTATION_REGISTRY.some((e) => e.key === key), key).toBe(true)
    const create = registrySourcesFor("create")
    expect(create.size).toBeGreaterThan(0)
    for (const s of create) expect(LISTING_PRESENCE_SOURCES).toContain(s)
  })
})

describe("[unitaire] creation witnesses (first price row, another trigger)", () => {
  it("matched / missing / before the start / within the clock margin", () => {
    const r = reconcileMutations(input({
      events: { rows: [ev("a", "created", null, true, 2)], truncated: false },
      creations: { rows: [{ listingId: "a", at: at(2) }, { listingId: "b", at: at(3) }, { listingId: "c", at: at(-1) }], truncated: false },
    }))
    const c = cls(r, "creation_prix")
    expect(c.outcomes.rapprochee).toBe(1)
    expect(c.outcomes.manquante).toBe(1) // b: a proved creation without « created »
    expect(c.notVerifiable.avant_le_debut).toBe(1) // c: never counted as missing
    expect(r.verdict).toBe("anomalies_confirmees")
    expect(r.confirmed.creationsSansEvenement).toBe(1)
    // Non-UTC database: 3 h after the start is inside the 14 h margin → not verifiable, not missing.
    const r2 = reconcileMutations(input({ clockMarginMs: CLOCK_MARGIN_NON_UTC_MS, creations: { rows: [{ listingId: "b", at: at(3) }], truncated: false } }))
    expect(cls(r2, "creation_prix").outcomes.manquante).toBe(0)
    expect(cls(r2, "creation_prix").notVerifiable.avant_le_debut).toBe(1)
    expect(r2.verdict).toBe("rien_de_verifiable")
  })
  it("attribution: expected source / unattributed / discordant", () => {
    const r = reconcileMutations(input({
      events: { rows: [ev("a", "created", null, true, 2), ev("b", "created", null, true, 2, "unattributed"), ev("c", "created", null, true, 2, "replacement")], truncated: false },
      creations: { rows: ["a", "b", "c"].map((l) => ({ listingId: l, at: at(2) })), truncated: false },
    }))
    expect(cls(r, "creation_prix").outcomes).toMatchObject({ rapprochee: 1, non_attribuee: 1, provenance_discordante: 1 })
    expect(r.verdict).toBe("attribution_a_verifier")
    expect(r.attribution).toEqual({ sourceAttendue: 1, nonAttribuee: 1, discordante: 1 })
  })
})

describe("[unitaire] logged withdrawals (same transaction as the update)", () => {
  const W = "affiliate.listing_withdrawn"
  it("unlisted event nearby → matched; the source comes from the registry entry of that path", () => {
    const r = reconcileMutations(input({
      events: { rows: [ev("a", "created", null, true, 1), ev("a", "unlisted", true, false, 5, "replacement"), ev("b", "created", null, true, 1), ev("b", "unlisted", true, false, 5, "reseller_ui")], truncated: false },
      audits: { rows: [{ listingId: "a", action: W, at: at(5) }, { listingId: "b", action: "affiliate.listing_replaced", at: at(5) }], truncated: false },
    }))
    expect(cls(r, "retrait_journalise").outcomes).toMatchObject({ rapprochee: 1, provenance_discordante: 1 })
  })
  it("already unlisted → consistent, no event due; listed and no event → MISSING; event hours away → clock uncertain; no history → unknown", () => {
    const r = reconcileMutations(input({
      events: { rows: [ev("a", "created", null, false, 1), ev("b", "created", null, true, 1), ev("c", "created", null, true, 1), ev("c", "unlisted", true, false, 10, "replacement")], truncated: false },
      audits: { rows: [{ listingId: "a", action: W, at: at(5) }, { listingId: "b", action: W, at: at(5) }, { listingId: "c", action: W, at: at(5) }, { listingId: "d", action: W, at: at(5) }, { listingId: "e", action: "something.else", at: at(5) }], truncated: false },
    }))
    const c = cls(r, "retrait_journalise")
    expect(c.witnesses).toBe(4) // unknown action ignored
    expect(c.outcomes.coherente_sans_evenement).toBe(1)
    expect(c.outcomes.manquante).toBe(1)
    expect(c.notVerifiable.horloge_incertaine).toBe(1)
    expect(c.notVerifiable.etat_anterieur_inconnu).toBe(1)
    expect(r.confirmed.retraitsSansEvenement).toBe(1)
  })
})

describe("[unitaire] current state of the listings", () => {
  it("contradiction, created after the start without « created », older listing without events (unknown), deletion without event", () => {
    const r = reconcileMutations(input({
      events: { rows: [ev("a", "created", null, true, 1), ev("gone", "created", null, true, 1), ev("ok", "created", null, true, 1), ev("del", "created", null, true, 1), ev("del", "deleted", true, null, 3)], truncated: false },
      listings: { rows: [{ id: "a", isListed: false, createdAt: at(1) }, { id: "new", isListed: true, createdAt: at(4) }, { id: "old", isListed: true, createdAt: at(-30) }, { id: "ok", isListed: true, createdAt: at(1) }], truncated: false },
    }))
    expect(r.confirmed).toMatchObject({ etatContreditHistorique: 1, creeesSansCreated: 1, suppressionsSansEvenement: 1 })
    const c = cls(r, "etat_courant")
    expect(c.outcomes.rapprochee).toBe(1)
    expect(c.notVerifiable.etat_anterieur_inconnu).toBe(1)
  })
})

describe("[unitaire] no conclusion without evidence; rates carry their denominator", () => {
  it("history absent or start unknown → indisponible", () => {
    expect(reconcileMutations(input({ events: null })).verdict).toBe("indisponible")
    expect(reconcileMutations(input({ trackingStart: null })).verdict).toBe("indisponible")
  })
  it("capped read → no rate, never « no anomaly »", () => {
    const r = reconcileMutations(input({ events: { rows: [ev("a", "created", null, true, 1)], truncated: true }, creations: { rows: [{ listingId: "a", at: at(1) }], truncated: false } }))
    expect(r.verdict).toBe("lecture_tronquee")
    expect(r.classes.every((c) => c.rate === null)).toBe(true)
  })
  it("no witness → « rien de vérifiable », said as absence of proof; unknown is never 0", () => {
    const r = reconcileMutations(input())
    expect(r.verdict).toBe("rien_de_verifiable")
    expect(r.statements.join(" ")).toMatch(/absence de preuve/)
    expect(r.classes.every((c) => c.rate === null)).toBe(true)
    const unread = reconcileMutations(input({ creations: null }))
    expect(cls(unread, "creation_prix").available).toBe(false)
    expect(cls(unread, "creation_prix").notVerifiable.source_illisible).toBe(1)
  })
  it("rate = numerator / denominator with a Wilson interval, flagged below the minimum", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ev(`l${i}`, "created", null, true, 2))
    const r = reconcileMutations(input({ events: { rows, truncated: false }, creations: { rows: rows.map((e) => ({ listingId: e.listingId, at: at(2) })), truncated: false } }))
    const rate = cls(r, "creation_prix").rate!
    expect(rate).toMatchObject({ numerator: 30, denominator: 30, value: 1, enough: true })
    expect(rate.low).toBeLessThan(1)
    expect(r.verdict).toBe("aucune_anomalie_sur_le_perimetre_verifie")
    expect(r.statements.join(" ")).toMatch(/périmètre vérifié/)
    const few = reconcileMutations(input({ events: { rows: rows.slice(0, 3), truncated: false }, creations: { rows: rows.slice(0, 3).map((e) => ({ listingId: e.listingId, at: at(2) })), truncated: false } }))
    expect(cls(few, "creation_prix").rate!.enough).toBe(false)
    expect(RATE_MIN_DENOMINATOR).toBe(20)
  })
})

describe("[unitaire] early detection — the day the capture stopped", () => {
  it("clean days then every witness lost → « rupture datée », quarantine days listed", () => {
    const evs = [ev("a", "created", null, true, 2), ev("b", "created", null, true, 26)]
    const creations = [{ listingId: "a", at: at(2) }, { listingId: "b", at: at(26) }, { listingId: "c", at: at(50) }, { listingId: "d", at: at(51) }]
    const r = reconcileMutations(input({ events: { rows: evs, truncated: false }, creations: { rows: creations, truncated: false } }))
    expect(r.degradation).toMatchObject({ kind: "rupture_datee", firstMissingDay: "2026-11-22", lastCleanDay: "2026-11-21", quarantineDays: ["2026-11-22"] })
  })
  it("a loss in the middle of clean days → « pertes isolées »", () => {
    const creations = [{ listingId: "a", at: at(2) }, { listingId: "x", at: at(26) }, { listingId: "b", at: at(50) }]
    const r = reconcileMutations(input({ events: { rows: [ev("a", "created", null, true, 2), ev("b", "created", null, true, 50)], truncated: false }, creations: { rows: creations, truncated: false } }))
    expect(r.degradation.kind).toBe("pertes_isolees")
  })
})

describe("[unitaire] event-side anomalies come from the integrity checks (one definition)", () => {
  it("passed through, not recomputed", () => {
    const integrity = { duplicates: 2, chainBreaks: 1, createdNotFirst: 0, afterDeleted: 0, futureEvents: 0, beforeTrackingStart: null, orderInversions: 3 } as unknown as IntegrityFacts
    expect(reconcileMutations(input({ integrity })).eventSide).toMatchObject({ duplicates: 2, chainBreaks: 1, orderInversions: 3, beforeTrackingStart: null })
  })
})

describe("[unitaire] readiness check + Collection Monitor", () => {
  const lossy = reconcileMutations(input({ events: { rows: [], truncated: false }, creations: { rows: [{ listingId: "b", at: at(3) }], truncated: false } }))
  const clean = reconcileMutations(input({ events: { rows: [ev("a", "created", null, true, 2)], truncated: false }, creations: { rows: [{ listingId: "a", at: at(2) }], truncated: false } }))
  it("check: BLOCKED on a proved loss, PASS when consistent, UNKNOWN with nothing verifiable — never critical", () => {
    expect(reconciliationCheck(lossy)).toMatchObject({ status: "BLOCKED", critical: false })
    expect(reconciliationCheck(clean)).toMatchObject({ status: "PASS", critical: false })
    expect(reconciliationCheck(reconcileMutations(input()))?.status).toBe("UNKNOWN")
    expect(reconciliationCheck(null)).toBeNull()
  })

  function snap(takenAt: string, rec: ReturnType<typeof reconcileMutations> | null, label: "etat_initial" | "J+1" = "J+1"): CollectionSnapshot {
    const readiness = {
      generatedAt: takenAt, global: "PASS", checks: [{ id: "B_capture", section: "B", status: "PASS", critical: true, executed: true }],
      volumes: { listingsWithHistory: 2, products: 1, resellers: 1, completePeriods: 1, ongoingPeriods: 1, unjudgedPeriods: 0, periodsWithSale: 0, censoredPeriods: 0, historyDays: 2 },
      target: { branch: "staging", endpoint: "ep-shy-wind-abc123" },
      facts: {
        migrationRow: "applied", migrationFinishedAt: "2026-11-20T00:00:00.000Z", tableExists: true,
        triggers: [{ name: "AffiliateProduct_listing_presence_history", enabled: "O", defects: 0 }],
        sessionReplicationRole: "origin", replicaDefaults: 0, roleOwnsTable: false, roleHasTruncate: false,
        integrity: { events: label === "J+1" ? 20 : 5, byKind: { created: 5 }, bySource: { reseller_ui: 5 }, newestEventAt: "2026-11-21T05:00:00.000Z", truncated: false, stateMismatches: 0, createdWithoutEvent: 0 },
        reconciliation: rec ? reconciliationFacts(rec) : null,
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildCollectionSnapshot({ readiness: readiness as any, appCommit: "bd58113bc", takenAt: new Date(takenAt), label })
  }

  it("a proved loss is a BLOCKING anomaly: J+1 unstable, every engine blocked, none executes", () => {
    const base = snap("2026-11-20T00:30:00.000Z", null, "etat_initial")
    const cur = snap("2026-11-21T06:00:00.000Z", lossy)
    expect(cur.anomalies.find((a) => a.code === "mutations_sans_evenement")?.severity).toBe("bloquant")
    const st = assessStability("J+1", base, cur)
    expect(st.verdict).toBe("instable")
    expect(st.criteria.find((c) => c.criterion === "rapprochement_mutations")?.met).toBe(false)
    expect(engineObservationDecisions(cur, null).every((d) => d.status === "anomalie_bloquante" && d.executesAutomatically === false)).toBe(true)
  })
  it("consistent witnesses add a met criterion; nothing verifiable adds none (never weakens)", () => {
    const base = snap("2026-11-20T00:30:00.000Z", null, "etat_initial")
    const ok = assessStability("J+1", base, snap("2026-11-21T06:00:00.000Z", clean))
    expect(ok.criteria.find((c) => c.criterion === "rapprochement_mutations")?.met).toBe(true)
    const none = assessStability("J+1", base, snap("2026-11-21T06:00:00.000Z", reconcileMutations(input())))
    expect(none.criteria.some((c) => c.criterion === "rapprochement_mutations")).toBe(false)
  })
  it("comparison carries witnesses and losses as deltas; the snapshot stays clean", () => {
    const a = snap("2026-11-20T00:30:00.000Z", clean, "etat_initial")
    const b = snap("2026-11-21T06:00:00.000Z", lossy)
    const c = compareSnapshots(a, b)
    if (!c.comparable) throw new Error("comparable expected")
    expect(c.volumes.mutationsSansEvenement).toEqual({ from: 0, to: 1, delta: 1 })
    expect(JSON.stringify(b)).not.toMatch(/"b"|listingId|:\/\//)
  })
})
