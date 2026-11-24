/**
 * Historical exposure (founder brief 2026-11-24 « Historical Exposure Intelligence »): one definition of a listed day,
 * read from the presence history, used by the sheet-quality measure, the copilot learning loop and the blind-spot
 * detector — coverage judged per window, unknown time never turned into listed or unlisted time, old vs new compared,
 * and the previous behaviour unchanged while HISTORICAL_EXPOSURE_MODE is off.
 *
 * Every history below is rebuilt by the REAL `rebuildPresence` from events, as the database would record them.
 */
import { describe, expect, it } from "vitest"

import {
  compareExposureMethods,
  exposureReliability,
  knownListedIntervals,
  lifecycleProfile,
  listedDaysBefore,
  mergeIntervals,
  readHistoricalExposureMode,
  shopExposures,
  windowCoverage,
  LIFECYCLE_MIN_LISTED_DAYS,
} from "@/lib/listing-presence/exposure"
import { rebuildPresence, type PresenceEvent, type PresenceHistory } from "@/lib/listing-presence/periods"
import {
  buildQualityEffectReport,
  compareQualityExposure,
  historicalQualityExposure,
  QUALITY_LIMITS,
  selectQualityExposure,
  type QualityExposure,
  type QualityOrderFact,
} from "@/lib/listing-quality/quality-effect"
import { presenceExposureOf, type BlindSpotProductInput } from "@/lib/reseller-copilot/blind-spots"
import { buildSnapshot, classifyCase, type ProposalCase, type ShopOrder } from "@/lib/reseller-copilot/learning"
import { discover } from "@/lib/reseller-copilot/learning-discovery"
import {
  buildExposureLearning,
  caseExposure,
  historicalSaleOutcome,
  LEARNING_EXPOSURE_HORIZON_DAYS,
  presenceForCase,
} from "@/lib/reseller-copilot/learning-exposure"
import { buildLearningReport } from "@/lib/reseller-copilot/learning-report"
import { TEMPORAL_MIN_OBSERVATION_DAYS } from "@/lib/reseller-copilot/temporal-opportunities"

const DAY = 86_400_000
const T0 = new Date("2026-01-01T00:00:00Z") // history began
const d = (n: number) => new Date(T0.getTime() + n * DAY)

const ev = (kind: PresenceEvent["kind"], at: number, prev: boolean | null, next: boolean | null): PresenceEvent => ({ kind, effectiveAt: d(at), previousListed: prev, newListed: next })
const created = (at: number, listed = true) => ev("created", at, null, listed)
const unlisted = (at: number) => ev("unlisted", at, true, false)
const listed = (at: number) => ev("listed", at, false, true)
const deleted = (at: number, wasListed = true) => ev("deleted", at, wasListed, null)

function history(events: PresenceEvent[], current: { isListed: boolean; createdAt: Date } | null, trackingStartedAt: Date | null = T0): PresenceHistory {
  return rebuildPresence({ current, events, trackingStartedAt })
}

describe("listed days — the shared definition", () => {
  it("1. continuous exposure: one period counted day for day", () => {
    const h = history([created(10)], { isListed: true, createdAt: d(10) })
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(0), d(40))
    expect(s!.listedDays).toBe(30)
    expect(s!.unknownDays).toBe(0)
    expect(s!.periods).toBe(1)
  })

  it("2–4. separate periods, withdrawal and relisting: withdrawn days are not exposure", () => {
    const h = history([created(2), unlisted(17), listed(32), unlisted(50)], { isListed: false, createdAt: d(2) })
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(0), d(60))
    expect(s!.listedDays).toBe(15 + 18)
    expect(s!.intervals).toHaveLength(2)
    expect(s!.withdrawals).toBe(2)
    expect(s!.relistings).toBe(1)
  })

  it("5. a deleted listing still counts the days it was really on sale", () => {
    const h = history([created(0), deleted(20)], null)
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(0), d(60))
    expect(s!.listedDays).toBe(20)
    expect(s!.withdrawals).toBe(1)
  })

  it("7. unknown start: counted only from when history began; before = unknown, never listed", () => {
    const h = history([], { isListed: true, createdAt: d(-40) }) // listed before history began
    expect(h.status).toBe("debut_inconnu")
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(-30), d(10))
    expect(s!.listedDays).toBe(10)
    expect(s!.unknownDays).toBe(30)
  })

  it("11. chronology anomaly (missing event): the gap is unknown, never listed", () => {
    // Withdrawn on day 10 by an unrecorded write; next event says it was NOT listed.
    const h = history([created(0), listed(20)], { isListed: true, createdAt: d(0) })
    expect(h.status).toBe("incoherent")
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(0), d(30))
    expect(s!.anomaly).toBe(true)
    expect(s!.listedDays + s!.unknownDays).toBeLessThanOrEqual(30)
    expect(exposureReliability(s!.listedDays, s!.unknownDays, true)).not.toBe("fiable")
  })

  it("12. simultaneous events (withdrawn and relisted at the same instant): no gap, no overlap", () => {
    const h = history([created(0), unlisted(10), listed(10)], { isListed: true, createdAt: d(0) })
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(0), d(20))
    expect(s!.listedDays).toBe(20)
    expect(mergeIntervals(s!.intervals)).toHaveLength(1)
  })

  it("13. UTC: the same instant written with an offset gives the same days; windows are half-open", () => {
    const at = new Date("2026-01-11T01:00:00+01:00") // = 2026-01-11T00:00Z = d(10)
    expect(at.getTime()).toBe(d(10).getTime())
    const h = history([{ kind: "created", effectiveAt: at, previousListed: null, newListed: true }, unlisted(20)], { isListed: false, createdAt: at })
    const [s] = shopExposures([{ affiliateId: "a", history: h }], d(10), d(20))
    expect(s!.listedDays).toBe(10)
    // A sale at exactly the withdrawal instant is outside the period [start, end).
    expect(knownListedIntervals(h, d(0), d(30)).some(([lo, hi]) => d(20).getTime() >= lo && d(20).getTime() < hi)).toBe(false)
  })

  it("14. no double counting: two listings of one shop (deleted, then recreated) are merged", () => {
    const h1 = history([created(0), deleted(15)], null)
    const h2 = history([created(10)], { isListed: true, createdAt: d(10) }) // overlaps on purpose (corrupted data)
    const [s] = shopExposures(
      [
        { affiliateId: "a", history: h1 },
        { affiliateId: "a", history: h2 },
      ],
      d(0),
      d(30),
    )
    expect(s!.listedDays).toBe(30)
  })

  it("listedDaysBefore counts only listed time before the sale", () => {
    expect(listedDaysBefore([[d(0).getTime(), d(5).getTime()], [d(10).getTime(), d(20).getTime()]], d(12).getTime())).toBe(7)
  })
})

describe("coverage — judged per window", () => {
  const read = { available: true, truncated: false, trackingStartedAt: d(30) }
  it("9. history complete on a recent window, partial on an older one", () => {
    expect(windowCoverage(read, d(30), d(90)).level).toBe("complete")
    expect(windowCoverage(read, d(40), d(90)).usable).toBe(true)
    expect(windowCoverage(read, d(0), d(90)).level).toBe("partielle")
    expect(windowCoverage(read, d(-90), d(0)).level).toBe("absente_sur_la_fenetre")
  })
  it("8 / 10. truncated read and absent history are never usable", () => {
    expect(windowCoverage({ ...read, truncated: true }, d(40), d(90)).level).toBe("lecture_tronquee")
    expect(windowCoverage({ available: false, truncated: false, trackingStartedAt: null }, d(0), d(1)).level).toBe("indisponible")
    expect(windowCoverage(null, d(0), d(1)).usable).toBe(false)
  })
  it("mode is off by default; only exact words switch it", () => {
    expect(readHistoricalExposureMode({})).toBe("off")
    expect(readHistoricalExposureMode({ HISTORICAL_EXPOSURE_MODE: "yes" })).toBe("off")
    expect(readHistoricalExposureMode({ HISTORICAL_EXPOSURE_MODE: " ON " })).toBe("on")
    expect(readHistoricalExposureMode({ HISTORICAL_EXPOSURE_MODE: "observe" })).toBe("observe")
  })
})

// ── Sheet quality ───────────────────────────────────────────────────────────────────────────────────────────────

const FROM = d(0)
const TO = d(90)
const order = (productId: string, affiliateId: string, at: number, closed = false): QualityOrderFact => ({ productId, affiliateId, paidAt: d(at), quantity: 1, closed })

describe("sheet quality on history", () => {
  // p1: listed since day 0 in shop a, withdrawn day 30, relisted day 60 (still on sale). The live estimate counts 90 days.
  const p1 = history([created(0), unlisted(30), listed(60)], { isListed: true, createdAt: d(0) })
  // p2: listed in shop b days 0–45 then deleted: invisible to the live estimate.
  const p2 = history([created(0), deleted(45)], null)
  const presence = new Map([
    ["p1", [{ affiliateId: "a", history: p1 }]],
    ["p2", [{ affiliateId: "b", history: p2 }]],
  ])

  it("6. a sale counts only inside a known listed period of THAT shop", () => {
    const { exposure } = historicalQualityExposure({
      productIds: ["p1", "p2"],
      presence,
      orders: [order("p1", "a", 10), order("p1", "a", 45), order("p1", "other", 70), order("p2", "b", 20, true)],
      from: FROM,
      to: TO,
    })
    expect(exposure.get("p1")).toMatchObject({ listingDays: 60, paidOrders: 1, ordersOutsideKnownPeriods: 2 })
    expect(exposure.get("p2")).toMatchObject({ listingDays: 45, paidOrders: 1, closedOrders: 1 })
  })

  it("old vs new: the live estimate over-counts a relisted listing and misses a deleted one", () => {
    const live = new Map<string, QualityExposure>([["p1", { listingDays: 90, paidOrders: 2, units: 2, closedOrders: 0 }]])
    const { exposure } = historicalQualityExposure({ productIds: ["p1", "p2"], presence, orders: [], from: FROM, to: TO })
    const c = compareQualityExposure(live, exposure)
    expect(c).toMatchObject({ units: 2, overestimated: 1, underestimated: 1, missedByLive: 1, liveDays: 90, historicalDays: 105 })
    expect(c.medianRatio).toBeCloseTo(60 / 90, 3)
  })

  it("8. a product whose history is not reliable over the window is left out, never measured on the live estimate", () => {
    const partial = history([], { isListed: true, createdAt: d(-100) }, d(50)) // history began day 50
    const { excluded } = historicalQualityExposure({ productIds: ["p3"], presence: new Map([["p3", [{ affiliateId: "a", history: partial }]]]), orders: [], from: FROM, to: TO })
    expect(excluded.has("p3")).toBe(true)
  })

  it("15. fallback: observe keeps the live estimate; on uses history only on a covered window", () => {
    const live = new Map([["p1", { listingDays: 90, paidOrders: 2, units: 2, closedOrders: 0, resellersListing: 1 }]])
    const historical = historicalQualityExposure({ productIds: ["p1", "p2"], presence, orders: [], from: FROM, to: TO })
    const obs = selectQualityExposure({ mode: "observe", coverage: "complete", usable: true, live, historical })
    expect(obs.basis.used).toBe("live_listings")
    expect(obs.exposure).toBe(live)
    expect(obs.basis.comparison?.units).toBe(2)
    const uncovered = selectQualityExposure({ mode: "on", coverage: "partielle", usable: false, live, historical: null })
    expect(uncovered.basis).toMatchObject({ used: "live_listings", coverage: "partielle", comparison: null })
    const on = selectQualityExposure({ mode: "on", coverage: "complete", usable: true, live, historical })
    expect(on.basis.used).toBe("presence_history")
    expect(on.exposure.get("p1")?.listingDays).toBe(60)
  })

  it("16. no approximation presented as history: the limits follow what was really used", () => {
    const base = { products: [], exposure: new Map(), now: TO, truncated: false }
    const liveR = buildQualityEffectReport({ ...base, exposureBasis: { mode: "on", coverage: "partielle", used: "live_listings", productsHistorical: 0, excludedUnreliable: 0, comparison: null } })
    expect(liveR.limits).toContain("listing_history_estimated")
    const histR = buildQualityEffectReport({ ...base, exposureBasis: { mode: "on", coverage: "complete", used: "presence_history", productsHistorical: 3, excludedUnreliable: 1, comparison: null } })
    expect(histR.limits).not.toContain("listing_history_estimated")
    expect(histR.limits).toContain("presence_is_not_traffic")
    expect(histR.exposureBasis?.used).toBe("presence_history")
  })

  it("20. regression: without a basis the report is exactly the previous one", () => {
    const r = buildQualityEffectReport({ products: [], exposure: new Map(), now: TO, truncated: false })
    expect(r.limits).toEqual(QUALITY_LIMITS)
    expect("exposureBasis" in r).toBe(false)
  })
})

// ── Copilot learning ────────────────────────────────────────────────────────────────────────────────────────────

const NOW = d(200)
const snapshot = buildSnapshot({
  profile: "rentable_demande_a_construire", flags: [], rank: 1, rankCriterion: "net", readiness: "pret", netCents: 800, feeBps: 2000, feeDefault: true,
  missing: [], fit: null, categoryId: "c", supplierPriceCents: 3000, paidOrders30d: 0, resellersListing: 2, ageDays: 60, offerMissingMeasured: 0, rising: false, stockKnown: true, shopListings: 12,
})
const sale = (at: number, closed = false): ShopOrder => ({ paidAt: d(at), quantity: 1, revenueHtCents: 4000, netCents: 700, closed })
const kase = (affiliateId: string, events: PresenceEvent[], current: { isListed: boolean; createdAt: Date } | null, orders: ShopOrder[], tracking = T0): ProposalCase => ({
  affiliateId,
  productId: "p",
  shownAt: d(99),
  snapshot,
  listingCreatedAt: d(100),
  viaCopilot: true,
  orders,
  presence: { trackingStartedAt: tracking, truncated: false, histories: [history(events, current, tracking)] },
})
const qualify = (c: ProposalCase) => caseExposure(c, classifyCase(c, NOW), NOW)

describe("copilot learning on history — what a « no sale » means", () => {
  it("the horizon is the temporal engine's floor, not a new figure", () => {
    expect(LEARNING_EXPOSURE_HORIZON_DAYS).toBe(TEMPORAL_MIN_OBSERVATION_DAYS)
  })

  it("not sold despite enough exposure", () => {
    const e = qualify(kase("a", [created(100)], { isListed: true, createdAt: d(100) }, []))
    expect(e).toMatchObject({ class: "non_vendu_exposition_suffisante", withinHorizon: "echec", listedDays: 30 })
  })
  it("withdrawn too early (2 days): censored, never a failure of the advice", () => {
    const c = kase("a", [created(100), unlisted(102)], { isListed: false, createdAt: d(100) }, [])
    expect(classifyCase(c, NOW).status).toBe("ajoute_sans_vente") // the reference definition calls it a failure
    expect(qualify(c)).toMatchObject({ class: "retire_trop_tot", withinHorizon: "censure", listedDays: 2 })
  })
  it("not sold with too little exposure (withdrawn, relisted late)", () => {
    const e = qualify(kase("a", [created(100), unlisted(103), listed(125)], { isListed: true, createdAt: d(100) }, []))
    expect(e).toMatchObject({ class: "non_vendu_exposition_insuffisante", withinHorizon: "censure", listedDays: 8 })
  })
  it("sold after a relisting", () => {
    const e = qualify(kase("a", [created(100), unlisted(103), listed(110)], { isListed: true, createdAt: d(100) }, [sale(112)]))
    expect(e).toMatchObject({ class: "vendu_apres_remise_en_vente", withinHorizon: "succes" })
  })
  it("sold after a long exposure: a success of the 30-day definition, a failure of « within H listed days »", () => {
    const e = qualify(kase("a", [created(100)], { isListed: true, createdAt: d(100) }, [sale(120)]))
    expect(e).toMatchObject({ class: "vendu_apres_longue_exposition", withinHorizon: "echec" })
  })
  it("uninterpretable when history began after the addition (coverage per case)", () => {
    const e = qualify(kase("a", [], { isListed: true, createdAt: d(100) }, [], d(110)))
    expect(e).toMatchObject({ class: "ininterpretable", reason: "couverture_posterieure_a_l_ajout" })
  })

  it("19. no future leakage: a sale after the reading moment is not read", () => {
    const c = kase("a", [created(100)], { isListed: true, createdAt: d(100) }, [sale(129)])
    const early = d(128)
    // Read on day 128: the window is not mature for the reference outcome either.
    expect(caseExposure(c, classifyCase(c, early), early)).toBeNull()
    expect(qualify(c)!.class).toBe("vendu_apres_longue_exposition")
  })

  it("18. isolation: a case reads only its own shop's listings", () => {
    const mine = { affiliateId: "a", productId: "p", history: history([created(0)], { isListed: true, createdAt: d(0) }) }
    const other = { affiliateId: "b", productId: "p", history: history([created(0), unlisted(1)], { isListed: false, createdAt: d(0) }) }
    const otherProduct = { affiliateId: "a", productId: "q", history: other.history }
    expect(presenceForCase([mine, other, otherProduct], "a", "p")).toEqual([mine.history])
  })

  it("17. coherence: quality, learning and blind spots count the same listed days for the same listing", () => {
    const events = [created(100), unlisted(108), listed(115)]
    const h = history(events, { isListed: true, createdAt: d(100) })
    const from = d(100)
    const to = d(130)
    const learning = qualify(kase("a", events, { isListed: true, createdAt: d(100) }, []))!.listedDays
    const quality = historicalQualityExposure({ productIds: ["p"], presence: new Map([["p", [{ affiliateId: "a", history: h }]]]), orders: [], from, to }).exposure.get("p")!.listingDays
    const blind = presenceExposureOf({ presence: [{ affiliateId: "a", history: h }], orders: [], listings: [] } as unknown as BlindSpotProductInput, from, to).listingDays
    expect(learning).toBe(23)
    expect(quality).toBe(23)
    expect(blind).toBe(23)
  })

  it("the report states both definitions on the same covered cases, and discovery switches only when complete and on", () => {
    const cases = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0
        ? kase(`r${i % 7}`, [created(100), unlisted(102)], { isListed: false, createdAt: d(100) }, [])
        : i % 3 === 1
          ? kase(`r${i % 7}`, [created(100)], { isListed: true, createdAt: d(100) }, [sale(105)])
          : kase(`r${i % 7}`, [created(100)], { isListed: true, createdAt: d(100) }, []),
    )
    const observe = buildLearningReport(cases, NOW, { exposureMode: "observe" })
    expect(observe.exposure).toMatchObject({ matureAdds: 30, covered: 30, complete: true })
    expect(observe.exposure!.classes).toMatchObject({ retire_trop_tot: 10, vendu: 10, non_vendu_exposition_suffisante: 10 })
    expect(observe.exposure!.withinHorizon).toMatchObject({ successes: 10, failures: 10, censored: 10, share: 0.5 })
    expect(observe.exposure!.legacyOnCovered).toMatchObject({ cases: 30, sold: 10, countedAsFailureButNotReallyExposed: 10 })
    expect(observe.discovery.saleBasis).toBe("reference_30_jours")
    const on = buildLearningReport(cases, NOW, { exposureMode: "on" })
    expect(on.discovery.saleBasis).toBe("historique_h_jours_en_vente")
    // One uncovered case → not complete → the reference outcome, never a mix.
    const mixed = buildLearningReport([...cases, kase("r9", [], { isListed: true, createdAt: d(100) }, [], d(150))], NOW, { exposureMode: "on" })
    expect(mixed.exposure!.complete).toBe(false)
    expect(mixed.discovery.saleBasis).toBe("reference_30_jours")
  })

  it("20. regression: mode off = no exposure block and the same report as before", () => {
    const cases = [kase("a", [created(100)], { isListed: true, createdAt: d(100) }, [])]
    const off = buildLearningReport(cases, NOW, { exposureMode: "off" })
    const legacy = buildLearningReport(cases, NOW)
    expect("exposure" in off).toBe(false)
    expect({ ...off, generatedAt: "" }).toEqual({ ...legacy, generatedAt: "" })
    const scored = cases.map((c) => ({ c, o: classifyCase(c, NOW) }))
    const { block, qualified } = buildExposureLearning(scored, NOW, { mode: "observe" })
    expect(historicalSaleOutcome(qualified, block)).toBeUndefined()
    expect(discover(scored).saleBasis).toBe("reference_30_jours")
  })
})

describe("old vs new — aggregate comparison", () => {
  it("tolerance: within 1 day or 5 % the methods agree", () => {
    const c = compareExposureMethods([
      { liveDays: 30, historicalDays: 29.5 },
      { liveDays: 100, historicalDays: 96 },
      { liveDays: 30, historicalDays: 10 },
      { liveDays: 0, historicalDays: 12 },
    ])
    expect(c).toMatchObject({ agree: 2, overestimated: 1, underestimated: 1, missedByLive: 1 })
  })
})

describe("lifecycle profile — when a listing stops selling, what a relisting changes (descriptive)", () => {
  it("rates by age of the period, from the period's OWN start; unknown starts left out; floors respected", () => {
    const listings: Array<{ affiliateId: string; productId: string; history: PresenceHistory }> = []
    const orders: Array<{ affiliateId: string; productId: string; paidAt: Date }> = []
    for (let i = 0; i < 30; i++) {
      const aff = `r${i}`
      // first period days 0–60 (sales: 2 in the first 14 days, 1 after 45), relisted 70–90 (2 sales).
      listings.push({ affiliateId: aff, productId: "p", history: history([created(0), unlisted(60), listed(70)], { isListed: true, createdAt: d(0) }) })
      for (const at of [3, 9, 50, 72, 80]) orders.push({ affiliateId: aff, productId: "p", paidAt: d(at) })
    }
    listings.push({ affiliateId: "old", productId: "p", history: history([], { isListed: true, createdAt: d(-50) }) })
    const prof = lifecycleProfile(listings, orders, d(0), d(90))
    expect(prof.periodsLeftOut).toBe(1)
    // 0–14: 30 shops × (14 + 14) days; orders 3, 9 and the relisted 72, 80 (ages 2 and 10).
    expect(prof.byAge["0-14"]).toMatchObject({ listedDays: 840, orders: 120, resellers: 30, reading: "reference" })
    expect(prof.byAge["45+"]).toMatchObject({ listedDays: 450, orders: 30 })
    expect(prof.byAge["45+"].reading).toBe("plus_bas")
    expect(prof.relisted.orders).toBe(60)
    expect(prof.firstPeriod.orders).toBe(90)
    expect(prof.nature).toBe("association_observee")
  })
  it("below the floors nothing is read", () => {
    const prof = lifecycleProfile([{ affiliateId: "a", productId: "p", history: history([created(0)], { isListed: true, createdAt: d(0) }) }], [], d(0), d(30))
    expect(prof.byAge["14-45"].reading).toBe("insuffisant")
    expect(prof.byAge["0-14"].ratePer100).toBeNull()
    expect(LIFECYCLE_MIN_LISTED_DAYS).toBe(300)
  })
})
