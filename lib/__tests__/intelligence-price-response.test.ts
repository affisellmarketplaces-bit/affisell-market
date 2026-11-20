import { describe, expect, it } from "vitest"

import {
  backtestEvents,
  impliedTenPercentCut,
  measurePriceEvents,
  metaAnalyse,
  poolPriceResponse,
  PRICE_RESPONSE_SCOPE,
  priceResponseSignals,
  PR_MIN_EVENTS,
  scorePredictions,
  scoreRecordedEstimates,
  signTestP,
  t975,
  PR_MODEL_VERSION,
  PR_RELIABLE,
  type ListingOrder,
  type PriceChange,
  type PriceEvent,
} from "@/lib/strategic-intelligence/price-response"

const DAY = 86_400_000
const now = new Date("2026-11-18T12:00:00Z")
const dataFrom = new Date(now.getTime() - 60 * DAY)
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY)
const noExclusions = { small_change: 0, window_incomplete: 0, overlapping_change: 0, too_few_listing_orders: 0, no_control: 0, listing_too_new: 0 }

/** `n` orders spread over [fromDaysAgo, toDaysAgo). */
function orders(listingId: string, productId: string, n: number, fromDaysAgo: number, toDaysAgo: number): ListingOrder[] {
  return Array.from({ length: n }, (_, i) => ({ listingId, productId, paidAt: at(fromDaysAgo - ((fromDaysAgo - toDaysAgo) * (i + 0.5)) / n) }))
}

/** One natural experiment: listing L of product P (reseller R-p) changes its price `daysAgo` ago; a control C does not.
 * `prior` = orders of L and C in the 14 days before the "before" window (placebo). */
function experiment(p: string, before: number, after: number, ctrlBefore: number, ctrlAfter: number, opt: { from?: number; to?: number; daysAgo?: number; reseller?: string; prior?: [number, number] } = {}) {
  const t = opt.daysAgo ?? 30
  const change: PriceChange = { listingId: `L-${p}`, productId: p, at: at(t), fromCents: opt.from ?? 1000, toCents: opt.to ?? 900, resellerId: opt.reseller ?? `R-${p}` }
  const o = [
    ...orders(`L-${p}`, p, before, t + 14, t),
    ...orders(`L-${p}`, p, after, t, t - 14),
    ...orders(`C-${p}`, p, ctrlBefore, t + 14, t),
    ...orders(`C-${p}`, p, ctrlAfter, t, t - 14),
    ...(opt.prior ? [...orders(`L-${p}`, p, opt.prior[0], t + 28, t + 14), ...orders(`C-${p}`, p, opt.prior[1], t + 28, t + 14)] : []),
  ]
  return { change, o }
}
const measure = (xs: ReturnType<typeof experiment>[], extra: Parameters<typeof measurePriceEvents>[2] extends infer C ? Partial<C> : never = {}) =>
  measurePriceEvents(xs.map((x) => x.change), xs.flatMap((x) => x.o), { now, dataFrom, ...extra })

describe("one event — difference-in-differences against the same product's other resellers", () => {
  it("a product-wide surge is NOT credited to the price cut", () => {
    const { events } = measure([experiment("p1", 10, 20, 10, 20)])
    expect(events).toHaveLength(1)
    expect(events[0]!.d).toBeCloseTo(0, 5)
  })

  it("a cut followed by more orders than the control gives a negative elasticity", () => {
    const e = measure([experiment("p2", 10, 20, 10, 10)]).events[0]!
    expect(e.d).toBeGreaterThan(0)
    expect(e.elasticity).toBeLessThan(0)
  })

  it("excludes what is not an experiment, and says why", () => {
    const tiny: PriceChange = { listingId: "Lt", productId: "pt", at: at(30), fromCents: 1000, toCents: 990 }
    const recent: PriceChange = { listingId: "Lr", productId: "pr", at: at(5), fromCents: 1000, toCents: 800 }
    const first: PriceChange = { listingId: "Lo", productId: "po", at: at(30), fromCents: 1000, toCents: 800 }
    const second: PriceChange = { listingId: "Lo", productId: "po", at: at(25), fromCents: 800, toCents: 700 }
    const lonely = experiment("pl", 10, 12, 0, 0)
    const { events, excluded } = measurePriceEvents([tiny, recent, first, second, lonely.change], lonely.o, { now, dataFrom })
    expect(events).toHaveLength(0)
    expect(excluded).toMatchObject({ small_change: 1, window_incomplete: 1, overlapping_change: 2, no_control: 1 })
  })

  it("a control whose own price — or one of its VARIANT prices — moved is not a control", () => {
    const x = experiment("pc", 10, 20, 10, 10)
    const ctrlChange: PriceChange = { listingId: "C-pc", productId: "pc", at: at(28), fromCents: 1000, toCents: 1200 }
    expect(measurePriceEvents([x.change, ctrlChange], x.o, { now, dataFrom }).excluded.no_control).toBeGreaterThanOrEqual(1)
    expect(measure([x], { otherChanges: [{ listingId: "C-pc", at: at(25) }] }).excluded.no_control).toBe(1)
  })

  it("a listing created inside the window: as the treated listing it is excluded, as a control it is ignored", () => {
    const x = experiment("pn", 10, 20, 10, 10)
    expect(measure([x], { listingCreatedAt: new Map([["L-pn", at(40)]]) }).excluded.listing_too_new).toBe(1)
    // A control launched mid-window would inflate the controls' "after" — it is dropped, leaving no control.
    expect(measure([x], { listingCreatedAt: new Map([["C-pn", at(35)]]) }).excluded.no_control).toBe(1)
  })

  it("keeps the reseller and the declared writer of the change", () => {
    const x = experiment("ps", 10, 20, 10, 10)
    const e = measurePriceEvents([{ ...x.change, source: "auto_adjust" }], x.o, { now, dataFrom }).events[0]!
    expect(e.resellerId).toBe("R-ps")
    expect(e.source).toBe("auto_adjust")
  })

  it("placebo: computed only when the data reach 14 more days back, and it detects a listing already drifting", () => {
    // Change 30 days ago: data start 60 days ago, placebo needs t − 28 = 58 days ago → available.
    const drifting = experiment("pd", 10, 20, 10, 10, { prior: [20, 10] }) // listing fell 20 → 10 while control stayed 10
    const e = measure([drifting]).events[0]!
    expect(e.pre).toBeDefined()
    expect(e.pre!.d).toBeLessThan(0)
    // Change 40 days ago: t − 28 = 68 days ago is before the data → no placebo.
    expect(measure([experiment("pe", 10, 20, 10, 10, { daysAgo: 40 })]).events[0]!.pre).toBeUndefined()
  })
})

describe("random-effects pooling", () => {
  it("Student quantiles", () => {
    expect(t975(1)).toBe(12.706)
    expect(t975(10)).toBe(2.228)
    expect(t975(120)).toBeCloseTo(1.98, 2)
  })

  it("agreeing estimates: no between-event variance, same mean as the fixed-effect pooling", () => {
    const m = metaAnalyse([{ y: -1, v: 0.1 }, { y: -1, v: 0.2 }, { y: -1, v: 0.3 }])!
    expect(m.tau2).toBe(0)
    expect(m.mean).toBeCloseTo(-1, 9)
    expect(m.mean).toBeCloseTo(m.fixedMean, 9)
  })

  it("disagreeing estimates: the interval is WIDER than the fixed-effect ±2 SE it replaces, and the one-product interval wider still", () => {
    const items = [-3, 0.5, -2.5, 1, -1].map((y) => ({ y, v: 0.05 }))
    const m = metaAnalyse(items)!
    expect(m.tau2).toBeGreaterThan(0)
    expect(m.i2).toBeGreaterThan(0.75)
    expect(m.hi - m.lo).toBeGreaterThan(4 * m.fixedSe)
    expect(m.predHi! - m.predLo!).toBeGreaterThan(m.hi - m.lo)
  })
})

describe("grade — five events are a first number, not trust", () => {
  const products = (k: number, opt: Parameters<typeof experiment>[5] = {}) => Array.from({ length: k }, (_, i) => experiment(`s${i}`, 20, 40, 20, 20, opt))
  const pooled = (xs: ReturnType<typeof experiment>[]) => poolPriceResponse(measure(xs).events)

  it("below the minimum number of events: no pool", () => {
    expect(pooled(products(PR_MIN_EVENTS - 1))).toBeNull()
  })

  it("every change made by one reseller: insufficient, whatever the consistency", () => {
    const r = pooled(products(8, { reseller: "R-same" }))!
    expect(r.grade).toBe("insuffisante")
    expect(r.gradeReasons.join(" ")).toMatch(/un seul revendeur/)
  })

  it("all events on 2 products: insufficient (events of a product share their controls)", () => {
    const xs = Array.from({ length: 6 }, (_, i) => experiment(i % 2 ? "A" : "B", 20, 40, 20, 20, { daysAgo: 20 + 2 * i, reseller: `R${i}` })).map((x, i) => ({
      ...x,
      change: { ...x.change, listingId: `L${i}` },
      o: x.o.map((o) => (o.listingId.startsWith("L-") ? { ...o, listingId: `L${i}` } : { ...o, listingId: `C${i}` })),
    }))
    expect(poolPriceResponse(measure(xs).events)?.grade ?? "insuffisante").toBe("insuffisante")
  })

  it("8 consistent experiments on 8 products and resellers: elastic, but only « faible » — and the reasons say why", () => {
    const r = pooled(products(8))!
    expect(r.verdict).toBe("elastic")
    expect(r.hi).toBeLessThan(-1)
    expect(r.grade).toBe("faible")
    expect(r.gradeReasons.join(" ")).toMatch(/8 changements de prix seulement/)
    expect(r.gradeReasons.join(" ")).toMatch(/hors échantillon/)
  })

  it("the minimum to COMPUTE is not the volume for a reliable conclusion: 3 products give a number, never « modérée »", () => {
    expect(PR_RELIABLE.products).toBeGreaterThan(3)
    const r = pooled(products(PR_MIN_EVENTS).slice(0, 5))!
    expect(r.grade).toBe("faible")
    expect(r.gradeReasons.join(" ")).toMatch(/pour une conclusion fiable/)
  })

  it("dependence: changes concentrated in one week, or mostly by one reseller, keep the grade « faible »", () => {
    const r = pooled(products(8))! // all on the same day
    expect(r.weeks).toBe(1)
    expect(r.gradeReasons.join(" ")).toMatch(/concentrés sur 1 semaine/)
    const mostlyOne = pooled(products(8).map((x, i) => ({ ...x, change: { ...x.change, resellerId: i < 6 ? "R-big" : x.change.resellerId } })))!
    expect(mostlyOne.influence.maxResellerShare).toBeCloseTo(0.75, 9)
    expect(mostlyOne.gradeReasons.join(" ")).toMatch(/un revendeur fait 75 %/)
  })

  it("a placebo showing listings already drifting downgrades the estimate", () => {
    const xs = products(8, { prior: [40, 20] }) // sales of the listing already halving vs control before every cut
    const r = pooled(xs)!
    expect(r.preTrend?.flagged).toBe(true)
    expect(r.gradeReasons.join(" ")).toMatch(/s’écartaient|s'écartaient/)
  })

  it("one product deciding the conclusion is flagged as fragile (and its weight shown)", () => {
    const x = Math.log(0.9)
    const ev = (p: string, y: number, v: number, i: number): PriceEvent => ({
      listingId: `L${p}${i}`, productId: p, resellerId: `R${p}${i}`, at: at(40 - i), fromCents: 1000, toCents: 900, x, a0: 1, a1: 1, b0: 1, b1: 1, d: y * x, varD: v * x * x, elasticity: y, varE: v,
    })
    // Product A: three precise, strongly elastic changes; B, C, D: noisy, mild. Without A the conclusion disappears.
    const r = poolPriceResponse([ev("A", -2, 0.05, 0), ev("A", -2, 0.05, 1), ev("A", -2, 0.05, 2), ev("B", -0.5, 2, 3), ev("C", -0.3, 2, 4), ev("D", -0.6, 2, 5)])!
    expect(r.verdict).toBe("elastic")
    expect(r.influence.fragile).toBe(true)
    expect(r.influence.maxProductWeight).toBeGreaterThan(0.9)
    expect(r.grade).toBe("faible")
    expect(r.gradeReasons.join(" ")).toMatch(/dépend d'un seul produit/)
  })
})

describe("validation — predictions checked against what happened next", () => {
  const ev = (daysAgo: number, d: number, x = Math.log(0.9), product = `p${Math.round(daysAgo)}`): PriceEvent => ({
    listingId: `L${daysAgo}`, productId: product, at: at(daysAgo), fromCents: 1000, toCents: 900, x, a0: 10, a1: 10, b0: 10, b1: 10, d, varD: 0.4, elasticity: d / x, varE: 0.4 / (x * x),
  })

  const item = (productId: string, d: number, mean = -2) => ({ productId, d, x: Math.log(0.9), varD: 0.4, mean, se: 0.2, tau2: 0 })

  it("model and constant volume are scored on the SAME observations and horizon (each item carries both errors)", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`p${i}`, 0.21 + (i % 3) * 0.01))
    const s = scorePredictions(items)
    expect(s.n).toBe(12)
    expect(s.maeConstant).toBeCloseTo(items.reduce((a, i) => a + Math.abs(i.d), 0) / 12, 9)
    expect(s.maeModel).toBeCloseTo(items.reduce((a, i) => a + Math.abs(i.d - i.mean * i.x), 0) / 12, 9)
  })

  it("a model that predicts the outcomes of many PRODUCTS beats constant volume; too few predictions or products: no verdict", () => {
    const good = Array.from({ length: 12 }, (_, i) => item(`p${i}`, 0.21 + (i % 3) * 0.01))
    expect(scorePredictions(good).verdict).toBe("meilleur")
    expect(scorePredictions(good.slice(0, 9)).verdict).toBe("trop_peu")
    expect(scorePredictions(good.map((g) => ({ ...g, d: -0.2 + (g.d - 0.21) }))).verdict).toBe("moins_bon")
  })

  it("many changes of ONE product count once: 12 good predictions on 2 products are « trop peu »", () => {
    const s = scorePredictions(Array.from({ length: 12 }, (_, i) => item(i % 2 ? "A" : "B", 0.21)))
    expect(s.products).toBe(2)
    expect(s.verdict).toBe("trop_peu")
  })

  it("a few atypical products can not carry the verdict: large wins on 4 products, slightly worse on 6 → not « meilleur »", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => item(`big${i}`, -30 * Math.log(0.9), -30)), // the model was spot on, by a lot
      ...Array.from({ length: 6 }, (_, i) => item(`small${i}`, 0.105)), // the model was a hair worse
    ]
    const s = scorePredictions(items)
    expect(s.z!).toBeGreaterThanOrEqual(2) // the mean alone would have said « better »…
    expect(s.productsBetter).toBe(4)
    expect(s.signP!).toBeGreaterThan(0.05) // …but most products disagree
    expect(s.verdict).toBe("non_tranche")
  })

  it("sign test", () => {
    expect(signTestP(10, 10)).toBeCloseTo(1 / 1024, 9)
    expect(signTestP(0, 10)).toBeCloseTo(1, 9)
  })

  it("backtest never looks ahead: an event is predicted only from events whose whole window had ended", () => {
    // 5 early events (≥ 14 days apart from the later ones) and later ones: only the later can be predicted.
    const early = [58, 57, 56, 55, 54].map((t) => ev(t - 10, 0.2))
    const late = [30, 29, 28].map((t) => ev(t, 0.2))
    expect(backtestEvents([...early, ...late]).n).toBe(3)
    expect(backtestEvents(early).n).toBe(0)
  })

  it("recorded history: only an estimate of the SAME model version, recorded AND built from data that end BEFORE the change", () => {
    const events = [ev(30, 0.2), ev(20, 0.2)]
    const rec = (recordedAt: Date, dataCutoff: Date, mean: number, over: Partial<{ poolKey: string; modelVersion: string }> = {}) => ({ poolKey: "marketplace", modelVersion: PR_MODEL_VERSION, recordedAt, dataCutoff, mean, se: 0.1, tau2: 0, ...over })
    const records = [
      rec(at(25), at(26), -2),
      rec(at(10), at(11), 5), // made after both changes: never used
      rec(at(24), at(19), 7), // recorded before the 2nd change but its DATA reach after it: never used for it
      rec(at(40), at(41), 5, { poolKey: "root:1" }), // another pool
      rec(at(22), at(23), 9, { modelVersion: "old" }), // another model version
    ]
    const s = scoreRecordedEstimates("marketplace", events, records)
    expect(s.n).toBe(1)
    expect(s.maeModel).toBeCloseTo(Math.abs(0.2 - -2 * Math.log(0.9)), 6)
  })
})

describe("signal wording", () => {
  const xs = Array.from({ length: 8 }, (_, i) => experiment(`w${i}`, 20, 40, 20, 20))

  it("noise around zero: no conclusion, and nothing claims 'no effect'", () => {
    const noisy = Array.from({ length: 8 }, (_, i) => experiment(`n${i}`, 6, i % 2 ? 7 : 5, 6, 6))
    const r = poolPriceResponse(measure(noisy).events)!
    expect(r.verdict).toBe("undetermined")
    const sig = priceResponseSignals([{ key: "all", label: "Marketplace", events: measure(noisy).events }], { observed: 8, usable: 8, excluded: noExclusions }, { observedAt: now.toISOString(), window: { from: dataFrom.toISOString(), to: now.toISOString() } })
    expect(sig.map((s) => s.id)).toEqual(["commercial:price_response:coverage"])
    expect(JSON.stringify(sig)).not.toMatch(/aucun effet|no effect/i)
  })

  it("a « faible » estimate is shown as a study, low confidence, with its grade, intervals, placebo and validation — never as a decision", () => {
    const [s] = priceResponseSignals([{ key: "root:1", label: "Maison", events: measure(xs).events }], { observed: 8, usable: 8, excluded: noExclusions }, { observedAt: now.toISOString(), window: null as never })
    expect(s!.id).toBe("commercial:price_response:root:1")
    expect(s!.kind).toBe("estimate")
    expect(s!.priority).toBe("study")
    expect(s!.confidence).toBe("low")
    expect(s!.title).toMatch(/^Maison : la demande a réagi fortement au prix — en moyenne/)
    expect(s!.title).toMatch(/fiabilité faible/)
    const ev = s!.evidence.map((e) => e.label).join(" | ")
    expect(ev).toMatch(/effets aléatoires/)
    expect(ev).toMatch(/produit pris isolément/)
    expect(ev).toMatch(/placebo/)
    expect(ev).toMatch(/hors échantillon/)
    expect(s!.recommendedAction).toMatch(/Ne rien décider/)
    expect(s!.confidenceReason).toContain(PRICE_RESPONSE_SCOPE)
  })

  it("the scope statement claims nothing the estimator does not do", () => {
    expect(PRICE_RESPONSE_SCOPE).toMatch(/même proportion/)
    expect(PRICE_RESPONSE_SCOPE).toMatch(/Non neutralisé/)
    expect(PRICE_RESPONSE_SCOPE).toMatch(/pas une preuve causale/)
    expect(PRICE_RESPONSE_SCOPE).not.toMatch(/trafic,? promotions/i) // traffic is NOT neutralised in general
  })

  it("implied effect of a 10 % cut: elasticity −2 → orders ≈ +23 %, revenue ≈ +11 %", () => {
    const r = impliedTenPercentCut(-2)
    expect(r.ordersPct).toBeCloseTo(23.46, 1)
    expect(r.revenuePct).toBeCloseTo(11.11, 1)
  })
})
