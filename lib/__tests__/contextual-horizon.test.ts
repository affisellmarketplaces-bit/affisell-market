import { describe, expect, it } from "vitest"

import {
  buildContextualReport,
  cellReliable,
  chiSquareP,
  contextualHorizonFor,
  FACTORS,
  FUITES,
  INCONNUS,
  kaplanMeier,
  kmHorizon,
  logRank,
  predict,
  readContextualMode,
  type FactorKey,
  type HorizonPeriod,
} from "@/lib/reseller-copilot/contextual-horizon"

const DAY = 86_400_000
const T0 = Date.parse("2026-01-01T00:00:00Z")

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const expo = (r: () => number, mean: number) => -Math.log(1 - r()) * mean

type Gen = { n: number; seed: number; resellers?: number; effect?: (f: Record<FactorKey, string>) => number; neverShare?: number; dominantReseller?: number }
/** Realistic synthetic periods: 40 products, several resellers, follow-up of 20–120 days, censoring by withdrawal. */
function generate(g: Gen): HorizonPeriod[] {
  const r = rng(g.seed)
  const cats = ["c1", "c2", "c3"]
  const out: HorizonPeriod[] = []
  for (let i = 0; i < g.n; i++) {
    const product = `p${i % 40}`
    const pi = i % 40
    const features: Record<FactorKey, string> = {
      categorie: cats[pi % 3]!,
      anciennete: ["<30j", "30-180j", "180j+"][Math.floor(r() * 3)]!,
      concurrence: ["seul", "1-2", "3+"][Math.floor(r() * 3)]!,
      remise_en_vente: r() < 0.15 ? "oui" : "non",
      prix: ["<25", "25-60", "60+"][pi % 3 === 0 ? 0 : Math.floor(r() * 3)]!,
      offre: r() < 0.5 ? "complete" : "incomplete",
      retour: r() < 0.2 ? "etendu" : "legal",
    }
    const affiliateId = g.dominantReseller && r() < g.dominantReseller ? "dominant" : `r${Math.floor(r() * (g.resellers ?? 25))}`
    const mean = g.effect ? g.effect(features) : 18
    const never = r() < (g.neverShare ?? 0.25)
    const delay = never ? null : expo(r, mean)
    const followUp = 20 + r() * 100
    const withdrawnEarly = r() < 0.2 ? 3 + r() * 15 : null
    const days = Math.min(followUp, withdrawnEarly ?? Infinity)
    const sold = delay != null && delay <= days
    out.push({ productId: product, affiliateId, start: T0 + i * 0.25 * DAY, days, firstSaleAfterDays: sold ? delay : null, features })
  }
  return out
}

describe("survival — censoring is never a failure", () => {
  it("Kaplan–Meier ignores nothing and invents nothing", () => {
    const km = kaplanMeier([
      { t: 5, event: true },
      { t: 10, event: false },
      { t: 15, event: true },
      { t: 20, event: false },
    ])
    expect(km).toEqual([
      { t: 5, F: 0.25 },
      { t: 15, F: 1 - 0.75 * 0.5 },
    ])
  })
  it("a period withdrawn early without a sale does not lower the horizon (censored, not « never »)", () => {
    const sold = Array.from({ length: 40 }, (_, i) => ({ t: 10 + (i % 20), event: true }))
    const withEarlyWithdrawals = [...sold, ...Array.from({ length: 40 }, () => ({ t: 3, event: false }))]
    expect(kmHorizon(withEarlyWithdrawals)).toBe(kmHorizon(sold))
  })
  it("horizon bounded [14, 60], rounded to the week when personalised, null without any sale", () => {
    expect(kmHorizon([{ t: 1, event: true }])).toBe(14)
    expect(kmHorizon([{ t: 85, event: true }])).toBe(60)
    expect(kmHorizon([{ t: 23, event: true }], true)).toBe(21)
    expect(kmHorizon([{ t: 30, event: false }])).toBeNull()
  })
})

describe("log-rank and chi-square", () => {
  it("chi-square tail matches known values", () => {
    expect(chiSquareP(3.841, 1)).toBeCloseTo(0.05, 3)
    expect(chiSquareP(5.991, 2)).toBeCloseTo(0.05, 3)
    expect(chiSquareP(0, 2)).toBe(1)
  })
  it("detects a real difference in first-sale timing and not an absent one", () => {
    const mk = (mean: number, seed: number, n = 120): HorizonPeriod[] => {
      const r = rng(seed)
      return Array.from({ length: n }, (_, i) => {
        const d = expo(r, mean)
        const f = 20 + r() * 80
        return { productId: `p${i}`, affiliateId: `r${i % 10}`, start: 0, days: f, firstSaleAfterDays: d <= f ? d : null, features: {} as Record<FactorKey, string> }
      })
    }
    expect(logRank([mk(8, 1), mk(30, 2)])!.p).toBeLessThan(0.001)
    expect(logRank([mk(15, 3), mk(15, 4)])!.p).toBeGreaterThan(0.05)
  })
})

describe("factor classes — no leakage, nothing invented", () => {
  it("every factor is either reconstructible exactly or explicitly recalculated; leaks and unknowns are excluded", () => {
    expect(FACTORS.map((f) => `${f.key}:${f.dataClass}`)).toEqual([
      "categorie:historise",
      "anciennete:historise",
      "concurrence:historise",
      "remise_en_vente:historise",
      "prix:recalcule",
      "offre:recalcule",
      "retour:recalcule",
    ])
    expect(FUITES).toContain("ventes_de_la_periode")
    expect(INCONNUS).toEqual(expect.arrayContaining(["trafic", "disponibilite_passee"]))
  })
})

describe("buildContextualReport — independent temporal validation", () => {
  it("a REAL context effect is found on the older half, confirmed on the newer half, and beats today's rule", () => {
    const periods = generate({ n: 3000, seed: 7, effect: (f) => (f.concurrence === "3+" ? 6 : f.concurrence === "seul" ? 40 : 18) })
    const r = buildContextualReport(periods)
    const conc = r.factors.find((f) => f.factor === "concurrence")!
    expect(conc.retained).toBe(true)
    expect(conc.stability).toBe("confirme")
    expect(conc.levels.find((l) => l.level === "3+")?.direction).toBe("plus_rapide")
    expect(conc.levels.find((l) => l.level === "seul")?.direction).toBe("plus_tardif")
    expect(r.chosenFactors).toContain("concurrence")
    const ctx = r.comparisons.find((c) => c.model === "contextuel")!
    expect(ctx.verdict).toBe("meilleur")
    expect(r.contextualVerdict).toBe("meilleur")
    // every test period was predicted without its own reseller; train strictly before test
    expect(r.split.trainPeriods + r.split.testPeriods).toBe(3000)
  })

  it("NO real effect: nothing retained (or only noise rejected) — the contextual model is abandoned, today's rule stays", () => {
    const r = buildContextualReport(generate({ n: 3000, seed: 11 }))
    expect(r.factors.filter((f) => f.retained)).toEqual([])
    expect(r.contextualVerdict).toBe("abandonne")
  })

  it("an effect carried by ONE dominant reseller is not robust", () => {
    const periods = generate({ n: 2500, seed: 13, dominantReseller: 0.6, effect: () => 18 }).map((p) =>
      p.affiliateId === "dominant" && p.features.retour === "etendu" && p.firstSaleAfterDays != null ? { ...p, firstSaleAfterDays: p.firstSaleAfterDays * 4 } : p,
    )
    const retour = buildContextualReport(periods).factors.find((f) => f.factor === "retour")!
    expect(retour.retained).toBe(false)
  })

  it("too little data: « insuffisant », no personalisation", () => {
    const r = buildContextualReport(generate({ n: 30, seed: 5 }))
    expect(r.contextualVerdict).toBe("insuffisant")
  })

  it("reports controls (censoring, relistings, dominant reseller / category) and calibration per model", () => {
    const r = buildContextualReport(generate({ n: 2000, seed: 17, effect: (f) => (f.categorie === "c1" ? 8 : 30) }))
    expect(r.controls.censoredShare).toBeGreaterThan(0.2)
    expect(r.controls.relistingShare).toBeGreaterThan(0.05)
    for (const s of r.scores) expect(["calibre", "trop_court", "trop_long", "insuffisant"]).toContain(s.calibration.verdict)
    expect(r.limits).toContain("association_pas_causalite")
    expect(JSON.stringify(r)).not.toMatch(/"r\d+"|dominant/)
  })
})

describe("prediction — the asking reseller is never its own reference", () => {
  it("excludes the target's reseller and falls back when a cell is thin", () => {
    const train = generate({ n: 400, seed: 3 })
    const target = { ...train[0]!, affiliateId: "r1" }
    const onlyR1 = train.map((p) => ({ ...p, affiliateId: "r1" }))
    expect(predict("general", onlyR1, target, [])).toBeNull()
    expect(predict("contextuel", train, target, ["concurrence"])?.horizonDays).toBeGreaterThanOrEqual(14)
    expect(cellReliable(train.slice(0, 5))).toBe(false)
  })
})

describe("contextualHorizonFor — use in the plan only when validated", () => {
  const periods = generate({ n: 3000, seed: 7, effect: (f) => (f.concurrence === "3+" ? 6 : f.concurrence === "seul" ? 40 : 18) })
  const features = periods[0]!.features
  it("null unless the model is « meilleur »", () => {
    expect(contextualHorizonFor({ version: "ch-v1", verdict: "experimental", factors: ["concurrence"], periods }, features, "x")).toBeNull()
    expect(contextualHorizonFor(null, features, "x")).toBeNull()
    expect(contextualHorizonFor({ version: "old", verdict: "meilleur", factors: ["concurrence"], periods }, features, "x")).toBeNull()
  })
  it("a validated profile gives a longer horizon for a product alone in its niche, explained by its factors", () => {
    const h = contextualHorizonFor({ version: "ch-v1", verdict: "meilleur", factors: ["concurrence"], periods }, { ...features, concurrence: "seul" }, "r1")!
    expect(h.direction).toBe("plus_tardif")
    expect(h.horizonDays % 7 === 0 || h.horizonDays === 60).toBe(true)
    expect(h.horizonDays - h.generalHorizonDays).toBeGreaterThanOrEqual(7)
    expect(h.factors).toEqual([{ factor: "concurrence", level: "seul" }])
    expect(h.resellers).toBeGreaterThanOrEqual(5)
    expect(Object.keys(h).sort()).toEqual(["direction", "factors", "generalHorizonDays", "horizonDays", "resellers", "sales"])
  })
  it("a profile close to the general horizon is not personalised", () => {
    expect(contextualHorizonFor({ version: "ch-v1", verdict: "meilleur", factors: ["concurrence"], periods }, { ...features, concurrence: "1-2" }, "r1")).toBeNull()
  })
})

describe("flag", () => {
  it("off by default", () => {
    expect(readContextualMode({})).toBe("off")
    expect(readContextualMode({ CONTEXTUAL_HORIZON_MODE: "observe" })).toBe("observe")
    expect(readContextualMode({ CONTEXTUAL_HORIZON_MODE: "1" })).toBe("off")
  })
})

// ── Integration with the observation plan, drift, labels ─────────────────────────────────────────────────────────

import fs from "node:fs"
import path from "node:path"

import { ageBand, competitionBand, factorDrift, parseSnapshot, priceBand, snapshotOf, CH_SNAPSHOT_KEYS } from "@/lib/reseller-copilot/contextual-horizon"
import { buildPlanMarker, parsePlanMarker, pickReference, planAtAdd } from "@/lib/reseller-copilot/observation-plan"
import { evaluatePlans } from "@/lib/reseller-copilot/observation-plan-eval"
import type { MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"

const mp = (aff: string, d: number | null, productId = "x"): MeasuredPeriod => ({ productId, affiliateId: aff, start: 0, end: null, days: 90, orders: d == null ? 0 : 1, closedOrders: 0, netCents: 0, firstSaleAfterDays: d, ongoing: true, isRelisting: false, withdrawal: null, deleted: false })
const ctx = { horizonDays: 42, generalHorizonDays: 26, direction: "plus_tardif" as const, factors: [{ factor: "concurrence" as const, level: "seul" }], resellers: 9, sales: 60 }

describe("observation plan — a validated profile changes the horizon, never the product's own reference", () => {
  const category = pickReference({ product: [], category: Array.from({ length: 40 }, (_, i) => mp(`r${i % 8}`, [5, 12, 18, 22, 26, 30][i % 6]!)), general: [] })
  const product = pickReference({ product: Array.from({ length: 40 }, (_, i) => mp(`r${i % 8}`, [5, 12, 18, 22, 26, 30][i % 6]!)), category: [], general: [] })
  it("category-tier plan follows the validated profile and says why", () => {
    const d = planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: category, contextual: ctx, now: new Date(0) })
    expect(d.plan).toMatchObject({ horizonDays: 42, context: ctx, tier: "category" })
    const m = buildPlanMarker("shown", d, { productId: "p", categoryId: "c" }, new Date(0))
    expect(m.contextual).toBe(true)
    expect(parsePlanMarker(m)?.contextual).toBe(true)
  })
  it("the product's own measured reference is never overridden", () => {
    expect(planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: product, contextual: ctx, now: new Date(0) }).plan).not.toHaveProperty("context")
  })
  it("no contextual input = exactly the previous plan", () => {
    const a = planAtAdd({ sellable: true, constraint: false, netPerSaleCents: 900, reference: category, now: new Date(0) })
    expect(a.plan?.horizonDays).toBe(category!.horizonDays)
    expect(a.plan).not.toHaveProperty("context")
  })
  it("the plan evaluation keeps contextual and standard horizons apart", () => {
    const e = evaluatePlans([], new Date())
    expect(e.horizonSource.map((h) => h.source)).toEqual(["contextuel", "standard"])
  })
})

describe("continuous loop — snapshots and drift", () => {
  const snap = (day: string, retained: string[], verdict: "meilleur" | "experimental" = "meilleur") => ({ version: "ch-v1", day, verdict, chosenFactors: retained, retained, contextualZ: 2.5, contextualCalibration: "calibre", baselineCalibration: "calibre", periods: 1000 })
  it("snapshot = closed list of aggregate fields", () => {
    const r = buildContextualReport(generate({ n: 400, seed: 2 }))
    const s = snapshotOf(r, "2026-11-24")
    expect(Object.keys(s).sort()).toEqual([...CH_SNAPSHOT_KEYS].sort())
    expect(parseSnapshot(s)).toEqual(s)
    expect(parseSnapshot({ ...s, reseller: "r1" })).toBeNull()
  })
  it("a factor useful for weeks then gone is « perdu »; a steady one « stable »; a new one « nouveau »", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 10).padStart(2, "0")}`)
    const snaps = days.map((d, i) => snap(d, i < 9 ? ["concurrence", "anciennete"] : ["concurrence", "prix"]))
    const drift = factorDrift(snaps)
    const by = Object.fromEntries(drift.factors.map((f) => [f.factor, f.state]))
    expect(by).toEqual({ concurrence: "stable", anciennete: "perdu", prix: "nouveau" })
    expect(factorDrift([{ ...snap("2026-11-01", ["x"]), version: "old" }]).snapshots).toBe(0)
  })
})

describe("labels — every profile level has a text, no category id is ever shown", () => {
  it("bands are coarse and every level maps to a translated key", () => {
    const fr = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages/fr.json"), "utf8")).affiliate.observationPlan.context.profile as Record<string, string>
    const LEVEL_KEY: Record<string, string> = { "<30j": "lt30", "30-180j": "m1_6", "180j+": "gt180", inconnue: "inconnue", seul: "seul", "1-2": "un_deux", "3+": "trois_plus", "<25": "lt25", "25-60": "p25_60", "60+": "gt60" }
    const levels: Array<[string, string]> = [
      ...[ageBand(5), ageBand(60), ageBand(400), ageBand(null)].map((l) => ["anciennete", l] as [string, string]),
      ...[competitionBand(0), competitionBand(2), competitionBand(9)].map((l) => ["concurrence", l] as [string, string]),
      ...[priceBand(1000), priceBand(3000), priceBand(9000)].map((l) => ["prix", l] as [string, string]),
      ["remise_en_vente", "oui"], ["remise_en_vente", "non"], ["offre", "complete"], ["offre", "incomplete"], ["offre", "non_mesuree"], ["retour", "etendu"], ["retour", "legal"],
    ]
    for (const [f, l] of levels) expect(fr[`${f}_${LEVEL_KEY[l] ?? l}`]).toBeTruthy()
    expect(fr.categorie).toBe("dans sa catégorie")
    const preview = fs.readFileSync(path.join(process.cwd(), "components/affiliate/observation-plan-preview.tsx"), "utf8")
    expect(preview).toContain('factor === "categorie" ? "categorie"')
  })
  it("the wording says indicative and comparable products, never a guarantee", () => {
    const fr = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages/fr.json"), "utf8")).affiliate.observationPlan.context
    expect(fr.basis).toMatch(/indicative/)
    expect(JSON.stringify(fr)).not.toMatch(/garanti/i)
  })
})
