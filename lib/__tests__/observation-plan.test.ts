import fs from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PresenceHistory } from "@/lib/listing-presence/periods"
import { resellerNextActions } from "@/lib/next-best-action/next-best-action"
import {
  buildPlanMarker,
  evaluationDue,
  followPlan,
  parsePlanMarker,
  pickReference,
  planArm,
  planAtAdd,
  PLAN_PAYLOAD_KEYS,
  readPlanHoldoutPct,
  readPlanMode,
  referenceOf,
  type FollowState,
  type PlanMarker,
} from "@/lib/reseller-copilot/observation-plan"
import { evaluatePlans, planOutcome, type PlanCaseInput } from "@/lib/reseller-copilot/observation-plan-eval"
import type { MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"

const DAY = 86_400_000
const NOW = new Date("2026-11-24T12:00:00Z")

function period(affiliateId: string, firstSaleAfterDays: number | null, days = 90, productId = "p1"): MeasuredPeriod {
  return { productId, affiliateId, start: NOW.getTime() - days * DAY, end: null, days, orders: firstSaleAfterDays == null ? 0 : 1, closedOrders: 0, netCents: 0, firstSaleAfterDays, ongoing: true, isRelisting: false, withdrawal: null, deleted: false }
}
function refs(n: number, resellers: number, delays: number[], quiet = 0, productId = "p1"): MeasuredPeriod[] {
  const out: MeasuredPeriod[] = []
  for (let i = 0; i < n; i++) out.push(period(`r${i % resellers}`, delays[i % delays.length]!, 90, productId))
  for (let i = 0; i < quiet; i++) out.push(period(`q${i % resellers}`, null, 90, productId))
  return out
}

describe("reference tiers — product, category, general, else nothing", () => {
  it("product first", () => {
    const r = pickReference({ product: refs(30, 6, [5, 12, 18, 22, 26, 30], 10), category: [], general: [] })!
    expect(r.tier).toBe("product")
    expect(r.horizonDays).toBe(26)
    expect(r.quartiles).toEqual({ p25: 12, p50: 18, p75: 26 })
    expect(r.saleSharePct).toBe(63) // 25 sold ≤ 26 d among 30 sellers + 10 quiet observed ≥ 26 d
  })
  it("product without history → its category", () => {
    expect(pickReference({ product: [], category: refs(40, 8, [10, 20, 30]), general: [] })?.tier).toBe("category")
  })
  it("category with too little data → the general reference, said as such", () => {
    expect(pickReference({ product: refs(5, 2, [10]), category: refs(15, 4, [10]), general: refs(80, 15, [8, 16, 24]) })?.tier).toBe("general")
  })
  it("nothing thick enough anywhere → no reference", () => {
    expect(pickReference({ product: [], category: refs(19, 5, [10]), general: refs(49, 10, [10]) })).toBeNull()
  })
  it("the sale share needs ≥ 20 known outcomes from ≥ 3 resellers", () => {
    expect(referenceOf(refs(12, 3, [10, 20]), "product")?.saleSharePct).toBeNull()
  })
})

describe("planAtAdd — the plan at the add", () => {
  const ref = pickReference({ product: refs(40, 6, [5, 12, 18, 22, 26, 30], 10), category: [], general: [] })
  it("gives an indicative horizon with provenance, sample, reliability and limits", () => {
    const d = planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: ref, now: NOW })
    expect(d.silence).toBeNull()
    expect(d.plan).toMatchObject({ horizonDays: 26, midpointDays: 18, tier: "product", resellers: 6, confidence: "moyenne" })
    expect(d.plan!.firstReviewAt).toBe(new Date(NOW.getTime() + 26 * DAY).toISOString())
    expect(d.plan!.limits).toContain("pas_une_garantie")
  })
  it("no horizon without enough data, without a sellable product, under a constraint, or when a sale pays too little", () => {
    expect(planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: null, now: NOW }).silence).toBe("reference_insuffisante")
    expect(planAtAdd({ sellable: false, constraint: false, netPerSaleCents: 900, reference: ref, now: NOW }).silence).toBe("non_vendable")
    expect(planAtAdd({ sellable: true, constraint: true, netPerSaleCents: 900, reference: ref, now: NOW }).silence).toBe("contrainte")
    expect(planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 150, reference: ref, now: NOW }).silence).toBe("gain_faible")
    expect(planAtAdd({ sellable: true, constraint: false, netPerSaleCents: null, reference: ref, now: NOW }).silence).toBe("gain_faible")
  })
  it("a category or general reference is never « moyenne »", () => {
    const cat = pickReference({ product: [], category: refs(80, 10, [10, 20, 30], 20), general: [] })
    expect(planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: cat, now: NOW }).plan).toMatchObject({ confidence: "faible", confidenceReason: "categorie_seulement" })
  })
  it("the horizon is contextual, not one duration for every product", () => {
    const fast = pickReference({ product: refs(30, 6, [1, 2, 3, 4, 5]), category: [], general: [] })!
    const slow = pickReference({ product: refs(30, 6, [20, 30, 40, 50]), category: [], general: [] })!
    expect(fast.horizonDays).toBe(14)
    expect(slow.horizonDays).toBe(40)
  })
})

const state = (over: Partial<FollowState> = {}): FollowState => ({
  historyAvailable: true,
  listedNow: true,
  uncertain: false,
  listedDaysSincePlan: 10,
  unknownDaysSincePlan: 0,
  salesSincePlan: 0,
  closedSincePlan: 0,
  problem: null,
  lowStock: false,
  netPerSaleCents: 900,
  offerGaps: 0,
  currentReference: null,
  ...over,
})

describe("followPlan — during the observation and at the evaluation", () => {
  it("no sale during the observation: no conclusion", () => {
    const s = followPlan(26, state())
    expect(s).toMatchObject({ phase: "observation", elapsedDays: 10, horizonDays: 26, remainingDays: 16, recommendation: null })
    expect(s.reasons).toContain("trop_tot_pour_conclure")
    expect(s.missing).toEqual(expect.arrayContaining(["trafic_non_mesure", "disponibilite_non_historisee"]))
  })
  it("an early sale: keep it (or reconsider when a sale pays too little)", () => {
    expect(followPlan(26, state({ salesSincePlan: 1 }))).toMatchObject({ phase: "vendu", recommendation: "conserver" })
    expect(followPlan(26, state({ salesSincePlan: 2, netPerSaleCents: 100 }))).toMatchObject({ phase: "vendu", recommendation: "reconsiderer" })
  })
  it("horizon reached without a sale: never « bad » — surveiller, unless something measured says otherwise", () => {
    const s = followPlan(26, state({ listedDaysSincePlan: 27 }))
    expect(s).toMatchObject({ phase: "evaluation", recommendation: "surveiller" })
    expect(s.reasons).toContain("trafic_non_mesure_pas_de_conclusion")
    expect(followPlan(26, state({ listedDaysSincePlan: 27, offerGaps: 2 })).recommendation).toBe("ameliorer")
    expect(followPlan(26, state({ listedDaysSincePlan: 27, netPerSaleCents: 150 })).recommendation).toBe("reconsiderer")
  })
  it("twice the horizon, where most comparable listings sold by then: reconsider", () => {
    const ref = pickReference({ product: refs(40, 6, [5, 12, 18, 22, 26, 30]), category: [], general: [] })!
    expect(followPlan(26, state({ listedDaysSincePlan: 55, currentReference: ref })).reasons).toContain("au_dela_du_double_horizon")
  })
  it("an unavailable product is « en pause »: its time does not judge its sales", () => {
    const stock = followPlan(26, state({ problem: "out_of_stock", listedDaysSincePlan: 40 }))
    expect(stock).toMatchObject({ phase: "indisponible", recommendation: "surveiller" })
    expect(stock.reasons).toContain("temps_indisponible_ne_juge_pas_les_ventes")
    expect(followPlan(26, state({ problem: "product_unavailable" })).recommendation).toBe("retirer_ou_remplacer")
  })
  it("withdrawn or deleted: nothing to advise", () => {
    expect(followPlan(26, state({ listedNow: false }))).toMatchObject({ phase: "retire", recommendation: null })
  })
  it("incomplete history: no conclusion", () => {
    expect(followPlan(26, state({ historyAvailable: false })).phase).toBe("donnees_insuffisantes")
    expect(followPlan(26, state({ uncertain: true })).phase).toBe("donnees_insuffisantes")
    expect(followPlan(26, state({ unknownDaysSincePlan: 3 })).missing).toContain("presence_partiellement_inconnue")
  })
  it("the horizon adapts when new data move it by ≥ 3 days, the initial one is kept", () => {
    const later = pickReference({ product: refs(40, 6, [10, 20, 30, 40]), category: [], general: [] })!
    const s = followPlan(26, state({ listedDaysSincePlan: 27, currentReference: later }))
    expect(s).toMatchObject({ initialHorizonDays: 26, horizonDays: 30, horizonUpdated: true, phase: "observation" })
    const same = pickReference({ product: refs(40, 6, [5, 12, 18, 22, 27, 30]), category: [], general: [] })!
    expect(followPlan(26, state({ currentReference: same })).horizonUpdated).toBe(false)
  })
  it("a plan without horizon gets one when the data arrive", () => {
    const ref = pickReference({ product: refs(40, 6, [5, 12, 18, 22, 26, 30]), category: [], general: [] })!
    expect(followPlan(null, state({ currentReference: ref }))).toMatchObject({ horizonDays: 26, horizonUpdated: false, phase: "observation" })
    expect(followPlan(null, state()).phase).toBe("sans_plan")
  })
  it("a price change shows in the evaluation (net per sale now)", () => {
    expect(followPlan(26, state({ listedDaysSincePlan: 30, netPerSaleCents: 50 })).recommendation).toBe("reconsiderer")
  })
  it("the evaluation is offered once, for a limited window", () => {
    expect(evaluationDue(followPlan(26, state({ listedDaysSincePlan: 27 })))).toBe(true)
    expect(evaluationDue(followPlan(26, state({ listedDaysSincePlan: 45 })))).toBe(false)
    expect(evaluationDue(followPlan(26, state()))).toBe(false)
    expect(evaluationDue(followPlan(26, state({ salesSincePlan: 1, listedDaysSincePlan: 30 })))).toBe(false)
  })
})

describe("flags, arms, markers", () => {
  it("off by default", () => {
    expect(readPlanMode({})).toBe("off")
    expect(readPlanMode({ OBSERVATION_PLAN_MODE: "true" })).toBe("off")
    expect(readPlanMode({ OBSERVATION_PLAN_MODE: "on" })).toBe("on")
    expect(readPlanHoldoutPct({})).toBe(0)
    expect(readPlanHoldoutPct({ OBSERVATION_PLAN_HOLDOUT_PCT: "75" })).toBe(50)
  })
  it("one arm per reseller × product, deterministic, observe never shows", () => {
    expect(planArm("off", "a", "p", 50)).toBeNull()
    expect(planArm("observe", "a", "p", 50)).toBe("would_show")
    expect(planArm("on", "a", "p", 0)).toBe("shown")
    const arms = Array.from({ length: 2000 }, (_, i) => planArm("on", `a${i}`, "p", 20))
    const held = arms.filter((a) => a === "held_out").length / arms.length
    expect(held).toBeGreaterThan(0.15)
    expect(held).toBeLessThan(0.25)
  })
  it("marker = closed list, no free text, silences recorded too", () => {
    const d = planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: null, now: NOW })
    const m = buildPlanMarker("would_show", d, { productId: "p1", categoryId: "c1" }, NOW)
    expect(Object.keys(m).sort()).toEqual([...PLAN_PAYLOAD_KEYS].sort())
    expect(parsePlanMarker(m)).toEqual(m)
    expect(parsePlanMarker({ ...m, note: "x" })).toBeNull()
    expect(parsePlanMarker({ ...m, silence: null, horizonDays: null })).toBeNull()
  })
})

// ── Evaluation ────────────────────────────────────────────────────────────────────────────────────────────────────

function hist(start: Date, end: Date | null, relist?: Date): PresenceHistory {
  const periods: PresenceHistory["periods"] = [{ start, startKnown: true, startLowerBound: null, end, ongoing: end == null, uncertain: false }]
  if (relist) periods.push({ start: relist, startKnown: true, startLowerBound: null, end: null, ongoing: true, uncertain: false })
  return { status: "historique_exact", periods, observedFrom: start, withdrawals: end ? 1 : 0, relistings: relist ? 1 : 0, gapsDays: [], deleted: false, consistent: true }
}
function pcase(arm: PlanMarker["arm"], o: { aff?: string; withdrawAt?: number; saleAt?: number; relistAt?: number; daysAgo?: number; predicted?: number | null; tier?: PlanMarker["tier"] } = {}): PlanCaseInput {
  const planned = new Date(NOW.getTime() - (o.daysAgo ?? 60) * DAY)
  const at = (d: number) => new Date(planned.getTime() + d * DAY)
  return {
    affiliateId: o.aff ?? "a1",
    marker: { arm, silence: null, horizonDays: 20, tier: o.tier ?? "product", saleSharePct: o.predicted === undefined ? 40 : o.predicted, confidence: "faible", categoryId: "c1", productId: "p1", plannedAt: planned.toISOString() },
    history: hist(planned, o.withdrawAt != null ? at(o.withdrawAt) : null, o.relistAt != null ? at(o.relistAt) : undefined),
    orders: o.saleAt != null ? [{ affiliateId: o.aff ?? "a1", paidAt: at(o.saleAt), quantity: 1, netCents: 0, closed: false }] : [],
  }
}

describe("planOutcome / evaluatePlans", () => {
  it("sold before the horizon, kept without a sale, late sale, withdrawn then relisted and sold", () => {
    expect(planOutcome(pcase("shown", { saleAt: 5 }), NOW)).toMatchObject({ mature: true, soldBeforeHorizon: true, keptToHorizon: true })
    expect(planOutcome(pcase("shown"), NOW)).toMatchObject({ keptNoSale: true, soldBeforeHorizon: false })
    expect(planOutcome(pcase("shown", { saleAt: 25 }), NOW)).toMatchObject({ lateSale: true, keptNoSale: true })
    expect(planOutcome(pcase("would_show", { withdrawAt: 3, relistAt: 8, saleAt: 10 }), NOW)).toMatchObject({ withdrawnBeforeHorizon: true, withdrawnWithPotential: true })
    expect(planOutcome(pcase("shown", { daysAgo: 10 }), NOW).mature).toBe(false)
  })
  it("a deleted listing (no current row) still counts from its history", () => {
    const c = pcase("shown", { withdrawAt: 4 })
    expect(planOutcome({ ...c, history: { ...c.history, deleted: true } }, NOW).withdrawnBeforeHorizon).toBe(true)
  })
  it("calibration: coherent, overestimated, insufficient", () => {
    const mk = (n: number, soldEvery: number, predicted: number) =>
      Array.from({ length: n }, (_, i) => pcase("shown", { aff: `a${i % 6}`, saleAt: i % soldEvery === 0 ? 5 : undefined, predicted }))
    expect(evaluatePlans(mk(40, 2, 50), NOW).calibration.find((c) => c.tier === "product")?.verdict).toBe("coherent")
    expect(evaluatePlans(mk(40, 5, 70), NOW).calibration.find((c) => c.tier === "product")?.verdict).toBe("surestime")
    expect(evaluatePlans(mk(10, 2, 50), NOW).calibration.find((c) => c.tier === "product")?.verdict).toBe("insuffisant")
  })
  it("shown vs held-out: a real difference is detected, no difference is « non concluant »", () => {
    const shown = Array.from({ length: 50 }, (_, i) => pcase("shown", { withdrawAt: i < 10 ? 2 : undefined, saleAt: i < 30 ? 5 : undefined }))
    const held = Array.from({ length: 50 }, (_, i) => pcase("held_out", { withdrawAt: i < 35 ? 2 : undefined, saleAt: i < 10 ? 5 : undefined }))
    const e = evaluatePlans([...shown, ...held], NOW)
    expect(e.comparison.find((c) => c.metric === "kept")?.verdict).toBe("plus_haut_avec_plan")
    expect(e.limits).toContain("association_pas_causalite")
    const same = (arm: "shown" | "held_out") => Array.from({ length: 30 }, (_, i) => pcase(arm, { saleAt: i % 2 ? 5 : undefined }))
    expect(evaluatePlans([...same("shown"), ...same("held_out")], NOW).comparison.every((c) => c.verdict === "non_concluant")).toBe(true)
  })
  it("silences are counted (« données insuffisantes » measured), recommendations followed for 30 days", () => {
    const silent: PlanCaseInput = { ...pcase("shown"), marker: { ...pcase("shown").marker, silence: "reference_insuffisante", horizonDays: null } }
    const withEval = { ...pcase("shown", { saleAt: 30 }), evaluation: { recommendation: "surveiller" as const, at: new Date(NOW.getTime() - 40 * DAY) } }
    const e = evaluatePlans([silent, withEval], NOW)
    expect(e).toMatchObject({ generated: 2, withHorizon: 1 })
    expect(e.silences.reference_insuffisante).toBe(1)
    expect(e.recommendations).toEqual([{ recommendation: "surveiller", count: 1, followed: 1, saleWithin30d: 1, salePct: null }])
  })
})

describe("next-best-action — one evaluation, never for an unsellable listing", () => {
  const review = { listingId: "l1", productId: "p1", productName: "Lampe", plannedDay: "2026-10-20", recommendation: "surveiller", elapsedDays: 27, horizonDays: 26, sales: 0 }
  it("offers the evaluation with its facts", () => {
    const a = resellerNextActions({ listings: [], drops: [], ready: [], planReviews: [review] })
    expect(a[0]).toMatchObject({ kind: "review_observation_plan", reason: "plan_surveiller", priority: "basse", observationPlan: { elapsedDays: 27, horizonDays: 26, sales: 0 } })
  })
  it("an unsellable listing keeps its own « fix » action instead", () => {
    const a = resellerNextActions({
      listings: [{ listingId: "l1", productId: "p1", name: "Lampe", problem: "out_of_stock", paidOrders30d: 0 }],
      drops: [],
      ready: [],
      planReviews: [review],
    })
    expect(a.map((x) => x.kind)).toEqual(["fix_shop_listing"])
  })
})

// ── Server, with its reads replaced (the real logic, no database) ──────────────────────────────────────────────────

const db = vi.hoisted(() => ({ auditRows: [] as Array<{ id: string; payload: unknown; entityId: string; actorId: string }>, createMany: vi.fn(), findFirst: vi.fn(), listing: null as unknown }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      createMany: (a: { data: Array<{ id: string; payload: unknown; entityId: string; actorId: string }> }) => {
        db.createMany(a)
        for (const r of a.data) if (!db.auditRows.some((x) => x.id === r.id)) db.auditRows.push(r)
        return { count: a.data.length }
      },
      findFirst: (a: { where: { entityId: string; actorId: string } }) => {
        db.findFirst(a)
        return db.auditRows.filter((r) => r.entityId === a.where.entityId && r.actorId === a.where.actorId && r.id.startsWith("observation-plan:")).at(-1) ?? null
      },
      findMany: () => [],
    },
    affiliateProduct: { findFirst: (a: { where: { id: string; affiliateId: string } }) => (a.where.affiliateId === "aff" ? db.listing : null) },
    order: { findMany: () => [] },
    user: { findUnique: () => ({ affiliatePlatformFeeBps: null }) },
    product: { findMany: () => [] },
  },
}))
const refSpy = vi.hoisted(() => vi.fn())
vi.mock("@/lib/reseller-copilot/observation-reference.server", () => ({
  loadReferencePeriods: async (o: unknown) => {
    refSpy(o)
    return { productPeriods: refs(40, 6, [5, 12, 18, 22, 26, 30], 10), categoryPeriods: [], generalPeriods: [] }
  },
}))
vi.mock("@/lib/reseller-copilot/selection.server", () => ({
  loadCandidates: async () => ({
    candidates: [
      { productId: "p1", name: "Lampe", imageUrl: null, basePriceCents: 2000, commissionRatePct: 10, commissionExplicit: true, stockUnits: 50, stockKnown: true, returnWindowDays: 14, paidOrders30d: 3, resellersListing: 4, inMyShop: false, awaitingReview: false, categoryId: "c1", offerMissingMeasured: [] },
    ],
    truncated: false,
  }),
}))
vi.mock("@/lib/commercial-readiness/readiness-context.server", () => ({ loadQualityEvidenceSafe: async () => [] }))
vi.mock("@/lib/listing-presence/presence.server", () => ({
  loadListingPresence: async () => ({ available: true, history: hist(new Date(NOW.getTime() - 30 * DAY), null) }),
  loadPresenceForProducts: async () => ({ available: true, truncated: false, trackingStartedAt: new Date(0), listings: [] }),
}))

describe("server — add, follow, isolation, flags", () => {
  beforeEach(() => {
    db.auditRows = []
    db.createMany.mockClear()
    db.findFirst.mockClear()
    refSpy.mockClear()
    db.listing = {
      productId: "p1",
      sellingPriceCents: 2600,
      affiliate: { affiliatePlatformFeeBps: null },
      product: { categoryId: "c1", basePriceCents: 2000, active: true, isDraft: false, tags: [], stock: 50, hasVariants: false, variants: null, listingKind: "PHYSICAL", commissionRate: 10, offerMode: null },
    }
  })

  it("flags off: nothing read, nothing written", async () => {
    vi.stubEnv("OBSERVATION_PLAN_MODE", "")
    const s = await import("@/lib/reseller-copilot/observation-plan.server")
    await s.recordPlansAfterAdd("aff", [{ listingId: "l1", productId: "p1" }], NOW)
    expect(await s.loadPlanPreview("aff", "p1", NOW)).toBeNull()
    expect(await s.loadListingPlanStatus("aff", "l1", NOW)).toBeNull()
    expect(db.createMany).not.toHaveBeenCalled()
    expect(refSpy).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it("add from the copilot records one plan per listing, idempotent, reference without the reseller itself", async () => {
    vi.stubEnv("OBSERVATION_PLAN_MODE", "on")
    const s = await import("@/lib/reseller-copilot/observation-plan.server")
    await s.recordPlansAfterAdd("aff", [{ listingId: "l1", productId: "p1" }], NOW)
    await s.recordPlansAfterAdd("aff", [{ listingId: "l1", productId: "p1" }], NOW)
    expect(db.auditRows).toHaveLength(1)
    expect(db.auditRows[0]!.id).toBe("observation-plan:l1:2026-11-24")
    expect(refSpy.mock.calls[0]![0]).toMatchObject({ productId: "p1", excludeAffiliateId: "aff" })
    expect(parsePlanMarker(db.auditRows[0]!.payload)).toMatchObject({ arm: "shown", horizonDays: 26, tier: "product" })
    vi.unstubAllEnvs()
  })

  it("follow + evaluation marker written once; another reseller sees nothing", async () => {
    vi.stubEnv("OBSERVATION_PLAN_MODE", "on")
    const s = await import("@/lib/reseller-copilot/observation-plan.server")
    db.auditRows.push({ id: "observation-plan:l1:2026-10-25", entityId: "l1", actorId: "aff", payload: buildPlanMarker("shown", planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: pickReference({ product: refs(40, 6, [5, 12, 18, 22, 26, 30], 10), category: [], general: [] }), now: new Date(NOW.getTime() - 30 * DAY) }), { productId: "p1", categoryId: "c1" }, new Date(NOW.getTime() - 30 * DAY)) })
    const v = await s.loadListingPlanStatus("aff", "l1", NOW)
    expect(v?.status).toMatchObject({ phase: "evaluation", recommendation: "surveiller", elapsedDays: 30 })
    await s.loadListingPlanStatus("aff", "l1", NOW)
    expect(db.auditRows.filter((r) => r.id.startsWith("observation-plan-eval:"))).toHaveLength(1)
    expect(await s.loadListingPlanStatus("other", "l1", NOW)).toBeNull()
    const json = JSON.stringify(v)
    expect(json).not.toMatch(/"r\d"|affiliateId|aff"/)
    vi.unstubAllEnvs()
  })

  it("the add path never waits: plans are recorded after the response, through a lazy import", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../reseller-copilot/selection.server.ts"), "utf8")
    expect(src).toMatch(/runAfterResponse\("observation-plan"/)
    expect(src).toMatch(/await import\("@\/lib\/reseller-copilot\/observation-plan\.server"\)/)
    expect(src).toMatch(/r\.ok && r\.created && r\.listing\.isListed/)
  })
})

describe("integration guards", () => {
  const root = path.resolve(__dirname, "../..")
  it("texts in 8 locales with the same keys, never a promise of a sale", () => {
    const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
    const flat = (o: Record<string, unknown>, pre = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]))
    const keys = locales.map((l) => flat(JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8")).affiliate.observationPlan).sort().join(","))
    expect(new Set(keys).size).toBe(1)
    for (const l of locales) {
      const na = JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8")).nextActions
      expect(na.kind.review_observation_plan).toBeTruthy()
      expect(na.planLine).toBeTruthy()
      for (const r of ["conserver", "ameliorer", "surveiller", "reconsiderer", "retirer_ou_remplacer"]) expect(na.reason[`plan_${r}`]).toBeTruthy()
    }
    const fr = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, "messages/fr.json"), "utf8")).affiliate.observationPlan)
    expect(fr).toContain("pas une garantie")
    expect(fr).not.toMatch(/mauvais produit|garanti(?!e de vente)/i)
  })
  it("client components import the plan as types only; the preview loads only when the panel opens", () => {
    for (const f of ["observation-plan-preview.tsx", "observation-plan-status.tsx"]) {
      const src = fs.readFileSync(path.join(root, "components/affiliate", f), "utf8")
      expect(src).toMatch(/import type \{[^}]+\} from "@\/lib\/reseller-copilot\/observation-plan"/)
      expect(src).not.toMatch(/disabled=/)
    }
    const panel = fs.readFileSync(path.join(root, "components/affiliate/reseller-copilot-panel.tsx"), "utf8")
    expect(panel).toContain("{opened ? <ObservationPlanPreview productId={productId} /> : null}")
  })
})
