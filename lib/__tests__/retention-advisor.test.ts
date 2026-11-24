import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { PresenceHistory } from "@/lib/listing-presence/periods"
import {
  buildRetentionMarker,
  decideRetentionAdvice,
  parseRetentionMarker,
  readRetentionHoldoutPct,
  readRetentionMode,
  retentionArm,
  retentionCaseKey,
  roundShare,
  RETENTION_PAYLOAD_KEYS,
  type RetentionInput,
} from "@/lib/reseller-copilot/retention-advisor"
import { caseOutcome, evaluateRetention, type RetentionCaseInput } from "@/lib/reseller-copilot/retention-advisor-eval"
import type { MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"

const DAY = 86_400_000
const NOW = new Date("2026-11-24T12:00:00Z")

function period(affiliateId: string, firstSaleAfterDays: number | null, days = 90, productId = "p1"): MeasuredPeriod {
  return {
    productId,
    affiliateId,
    start: NOW.getTime() - days * DAY,
    end: null,
    days,
    orders: firstSaleAfterDays == null ? 0 : 1,
    closedOrders: 0,
    netCents: 0,
    firstSaleAfterDays,
    ongoing: true,
    isRelisting: false,
    withdrawal: null,
    deleted: false,
  }
}

/** n selling periods spread over `resellers` shops with first-sale delays cycling through `delays`, + `quiet` never-sold periods. */
function refs(n: number, resellers: number, delays: number[], quiet = 0, productId = "p1"): MeasuredPeriod[] {
  const out: MeasuredPeriod[] = []
  for (let i = 0; i < n; i++) out.push(period(`r${i % resellers}`, delays[i % delays.length]!, 90, productId))
  for (let i = 0; i < quiet; i++) out.push(period(`q${i % resellers}`, null, 90, productId))
  return out
}

function input(over: Partial<RetentionInput> = {}, currentDays = 10): RetentionInput {
  return {
    current: { historyAvailable: true, listed: true, start: new Date(NOW.getTime() - currentDays * DAY), startKnown: true, uncertain: false, ordersInPeriod: 0 },
    sellable: true,
    constraints: [],
    netPerSaleCents: 900,
    productPeriods: refs(30, 6, [5, 12, 18, 22, 26, 30]),
    categoryPeriods: [],
    now: NOW,
    ...over,
  }
}

describe("decideRetentionAdvice — when it speaks", () => {
  it("advises with the product tier, measured delays and a justified extra time", () => {
    const d = decideRetentionAdvice(input())
    expect(d.silence).toBeNull()
    const a = d.advice!
    expect(a.tier).toBe("product")
    expect(a.currentDays).toBe(10)
    expect(a.recommendedDays).toBe(26)
    expect(a.extraDays).toBe(16)
    expect(a.resellers).toBe(6)
    expect(a.sales).toBe(30)
    expect(a.quartiles).toEqual({ p25: 12, p50: 18, p75: 26 })
    expect(a.lateSharePct).toBe(83)
    expect(a.conditional).toEqual({ pct: 80, atRisk: 25 })
  })

  it("falls back to the category only when the product reference is too thin", () => {
    const d = decideRetentionAdvice(input({ productPeriods: refs(8, 2, [20]), categoryPeriods: refs(40, 8, [15, 25, 35, 40], 0, "p9") }))
    expect(d.advice?.tier).toBe("category")
    expect(d.advice?.confidenceReason).toBe("categorie_seulement")
    expect(d.advice?.confidence).toBe("faible")
  })

  it("recommended duration stays within [14, 60] days", () => {
    expect(decideRetentionAdvice(input({ productPeriods: refs(32, 6, [40, 55, 70, 90]) })).advice?.recommendedDays).toBe(60)
    expect(decideRetentionAdvice(input({ productPeriods: refs(30, 6, [1, 2, 10, 13]) }, 5)).advice?.recommendedDays).toBe(14)
  })

  it("medium confidence only with the product tier, ≥ 5 resellers and ≥ 40 listings at risk", () => {
    const strong = decideRetentionAdvice(input({ productPeriods: refs(60, 8, [12, 18, 22, 26, 30]) }))
    expect(strong.advice?.confidence).toBe("moyenne")
    const weak = decideRetentionAdvice(input({ productPeriods: refs(12, 3, [12, 18, 22, 26]) }))
    expect(weak.advice?.confidence).toBe("faible")
  })
})

describe("decideRetentionAdvice — when it stays silent", () => {
  const cases: Array<[string, Partial<RetentionInput>, number, string]> = [
    ["history unavailable", { current: { ...input().current, historyAvailable: false } }, 10, "historique_indisponible"],
    ["not listed", { current: { ...input().current, listed: false } }, 10, "pas_en_vente"],
    ["unknown start", { current: { ...input().current, startKnown: false } }, 10, "debut_inconnu"],
    ["uncertain edge", { current: { ...input().current, uncertain: true } }, 10, "debut_inconnu"],
    ["already sold this period", { current: { ...input().current, ordersInPeriod: 1 } }, 10, "deja_vendu"],
    ["Affisell constraint", { constraints: ["affisell_hold"] }, 10, "contrainte"],
    ["stock constraint", { constraints: ["stock"] }, 10, "contrainte"],
    ["not sellable", { sellable: false }, 10, "non_vendable"],
    ["low net per sale", { netPerSaleCents: 150 }, 10, "gain_faible"],
    ["net unknown", { netPerSaleCents: null }, 10, "gain_faible"],
    ["loss-making", { netPerSaleCents: -50 }, 10, "gain_faible"],
    ["thin reference everywhere", { productPeriods: refs(9, 3, [20]), categoryPeriods: refs(19, 5, [20], 0, "p9") }, 10, "reference_insuffisante"],
    ["two resellers only", { productPeriods: refs(30, 2, [20]) }, 10, "reference_insuffisante"],
  ]
  it.each(cases)("%s", (_label, over, days, silence) => {
    expect(decideRetentionAdvice(input(over, days))).toEqual({ advice: null, silence })
  })

  it("already observed for the recommended duration", () => {
    expect(decideRetentionAdvice(input({}, 30)).silence).toBe("deja_observe")
  })

  it("no extra time can be justified (few late first sales)", () => {
    expect(decideRetentionAdvice(input({ productPeriods: refs(30, 6, [2, 3, 4, 5, 6, 30]) }, 10)).silence).toBe("pas_de_delai_justifie")
  })

  it("too close to the recommended duration (< 3 days left)", () => {
    expect(decideRetentionAdvice(input({}, 24)).silence).toBe("pas_de_delai_justifie")
  })

  it("listings in the same situation almost never sold afterwards", () => {
    const d = decideRetentionAdvice(input({ productPeriods: refs(30, 6, [5, 12, 18, 22, 26, 30], 600) }))
    expect(d.silence).toBe("chance_faible")
  })
})

describe("confidentiality of the advice", () => {
  it("exposes aggregates only — no reseller id, no amount", () => {
    const a = decideRetentionAdvice(input()).advice!
    const json = JSON.stringify(a)
    expect(json).not.toMatch(/"r\d"|affiliateId|netCents|Cents/)
    expect(Object.keys(a).sort()).toEqual(
      ["confidence", "confidenceReason", "conditional", "currentDays", "extraDays", "lateSharePct", "quartiles", "recommendedDays", "resellers", "sales", "tier"].sort(),
    )
    expect(a.resellers).toBeGreaterThanOrEqual(3)
  })
  it("small samples are rounded to 5 points", () => {
    expect(roundShare(0.43, 12)).toBe(45)
    expect(roundShare(0.43, 40)).toBe(43)
  })
})

describe("flags and experiment arms", () => {
  it("off by default, observe and on only on the exact words", () => {
    expect(readRetentionMode({})).toBe("off")
    expect(readRetentionMode({ RETENTION_ADVISOR_MODE: "yes" })).toBe("off")
    expect(readRetentionMode({ RETENTION_ADVISOR_MODE: "observe" })).toBe("observe")
    expect(readRetentionMode({ RETENTION_ADVISOR_MODE: " ON " })).toBe("on")
  })
  it("hold-out 0 by default, capped at 50 %", () => {
    expect(readRetentionHoldoutPct({})).toBe(0)
    expect(readRetentionHoldoutPct({ RETENTION_ADVISOR_HOLDOUT_PCT: "abc" })).toBe(0)
    expect(readRetentionHoldoutPct({ RETENTION_ADVISOR_HOLDOUT_PCT: "90" })).toBe(50)
    expect(readRetentionHoldoutPct({ RETENTION_ADVISOR_HOLDOUT_PCT: "20" })).toBe(20)
  })
  it("arms: off none, observe never shows, on with no hold-out always shows, deterministic randomisation", () => {
    expect(retentionArm("off", "k", 50)).toBeNull()
    expect(retentionArm("observe", "k", 50)).toBe("would_show")
    expect(retentionArm("on", "k", 0)).toBe("shown")
    const keys = Array.from({ length: 2000 }, (_, i) => retentionCaseKey(`l${i}`, new Date("2026-11-01")))
    const held = keys.filter((k) => retentionArm("on", k, 30) === "held_out").length
    expect(held / keys.length).toBeGreaterThan(0.25)
    expect(held / keys.length).toBeLessThan(0.35)
    expect(keys.map((k) => retentionArm("on", k, 30))).toEqual(keys.map((k) => retentionArm("on", k, 30)))
  })
  it("one case per listing × period start day", () => {
    expect(retentionCaseKey("l1", new Date("2026-11-03T22:00:00Z"))).toBe("l1:2026-11-03")
  })
  it("marker holds a closed list of fields and refuses anything else", () => {
    const a = decideRetentionAdvice(input()).advice!
    const m = buildRetentionMarker("shown", a, { categoryId: "c1", productId: "p1" }, new Date("2026-11-14T00:00:00Z"))
    expect(Object.keys(m).sort()).toEqual([...RETENTION_PAYLOAD_KEYS].sort())
    expect(parseRetentionMarker(m)).toEqual(m)
    expect(parseRetentionMarker({ ...m, note: "free text" })).toBeNull()
    expect(parseRetentionMarker({ ...m, arm: "maybe" })).toBeNull()
  })
})

// ── Evaluation ────────────────────────────────────────────────────────────────────────────────────────────────────

function history(start: Date, end: Date | null, relistAt?: Date): PresenceHistory {
  const periods: PresenceHistory["periods"] = [
    { start, startKnown: true, startLowerBound: null, end, ongoing: end == null, uncertain: false },
  ]
  if (relistAt) periods.push({ start: relistAt, startKnown: true, startLowerBound: null, end: null, ongoing: true, uncertain: false })
  return { status: "historique_exact", periods, observedFrom: start, withdrawals: end ? 1 : 0, relistings: relistAt ? 1 : 0, gapsDays: [], deleted: false, consistent: true }
}

function evalCase(arm: "shown" | "held_out" | "would_show", opts: { withdrawAfterDays?: number; saleAfterDays?: number; relistAfterDays?: number; markedDaysAgo?: number } = {}): RetentionCaseInput {
  const markedDaysAgo = opts.markedDaysAgo ?? 60
  const markedAt = new Date(NOW.getTime() - markedDaysAgo * DAY)
  const start = new Date(markedAt.getTime() - 10 * DAY)
  const end = opts.withdrawAfterDays != null ? new Date(markedAt.getTime() + opts.withdrawAfterDays * DAY) : null
  const relist = opts.relistAfterDays != null ? new Date(markedAt.getTime() + opts.relistAfterDays * DAY) : undefined
  return {
    marker: { arm, tier: "product", currentDays: 10, recommendedDays: 26, lateSharePct: 80, conditionalPct: 30, confidence: "faible", categoryId: "c1", productId: "p1", periodStart: start.toISOString() },
    markedAt,
    history: history(start, end, relist),
    orders: opts.saleAfterDays != null ? [{ affiliateId: "a", paidAt: new Date(markedAt.getTime() + opts.saleAfterDays * DAY), quantity: 1, netCents: 0, closed: false }] : [],
  }
}

describe("caseOutcome", () => {
  it("withdrawn right after the advice", () => {
    const o = caseOutcome(evalCase("shown", { withdrawAfterDays: 0.1 }), NOW)
    expect(o).toMatchObject({ mature: true, withdrawnSoon: true, keptToRecommended: false, saleAfter: false })
  })
  it("kept to the recommended duration then sold", () => {
    const o = caseOutcome(evalCase("shown", { saleAfterDays: 12 }), NOW)
    expect(o).toMatchObject({ keptToRecommended: true, saleAfter: true, notBorneOut: false })
  })
  it("kept, no sale: the advice was not borne out", () => {
    expect(caseOutcome(evalCase("shown"), NOW).notBorneOut).toBe(true)
  })
  it("withdrawn, relisted and sold: a withdrawal that had potential", () => {
    const o = caseOutcome(evalCase("would_show", { withdrawAfterDays: 1, relistAfterDays: 5, saleAfterDays: 8 }), NOW)
    expect(o).toMatchObject({ withdrawnSoon: true, relisted: true, saleAfter: true, withdrawnWithPotential: true })
  })
  it("a sale while the listing was withdrawn does not count", () => {
    expect(caseOutcome(evalCase("shown", { withdrawAfterDays: 1, saleAfterDays: 5 }), NOW).saleAfter).toBe(false)
  })
  it("not mature before the horizon", () => {
    expect(caseOutcome(evalCase("shown", { markedDaysAgo: 5 }), NOW).mature).toBe(false)
  })
})

describe("evaluateRetention", () => {
  it("insufficient below 20 mature cases per arm", () => {
    const e = evaluateRetention([evalCase("shown"), evalCase("held_out")], NOW)
    expect(e.comparison.every((c) => c.verdict === "insuffisant")).toBe(true)
    expect(e.limits).toContain("association_pas_causalite")
  })
  it("detects more kept listings and more sales with the advice in a randomised comparison", () => {
    const shown = Array.from({ length: 60 }, (_, i) => evalCase("shown", i < 45 ? { saleAfterDays: 12 } : { withdrawAfterDays: 0.5 }))
    const held = Array.from({ length: 60 }, (_, i) => evalCase("held_out", i < 15 ? { saleAfterDays: 12 } : { withdrawAfterDays: 0.5 }))
    const e = evaluateRetention([...shown, ...held], NOW)
    const kept = e.comparison.find((c) => c.metric === "kept")!
    const sale = e.comparison.find((c) => c.metric === "sale")!
    expect(kept.verdict).toBe("plus_haut_avec_conseil")
    expect(sale.verdict).toBe("plus_haut_avec_conseil")
    expect(e.byCategory).toHaveLength(1)
    const arm = e.arms.find((a) => a.arm === "shown")!
    expect(arm).toMatchObject({ cases: 60, mature: 60, withdrawnSoon: 15, keptToRecommended: 45, saleAfter: 45 })
  })
  it("no difference = non conclusive, never a verdict", () => {
    const mk = (arm: "shown" | "held_out") => Array.from({ length: 40 }, (_, i) => evalCase(arm, i % 2 ? { saleAfterDays: 12 } : {}))
    const e = evaluateRetention([...mk("shown"), ...mk("held_out")], NOW)
    expect(e.comparison.every((c) => c.verdict === "non_concluant")).toBe(true)
  })
  it("observe mode is descriptive: no comparison without a hold-out", () => {
    const e = evaluateRetention(Array.from({ length: 50 }, () => evalCase("would_show", { saleAfterDays: 3 })), NOW)
    expect(e.comparison.every((c) => c.verdict === "insuffisant")).toBe(true)
    expect(e.arms.find((a) => a.arm === "would_show")?.saleShareIfKeptPct).toBe(100)
  })
})

describe("integration guards", () => {
  const root = path.resolve(__dirname, "../..")
  it("texts exist in the 8 locales with the same keys", () => {
    const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
    const keys = locales.map((l) => Object.keys(JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8")).affiliate.retentionAdvice).sort().join(","))
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toContain("noGuarantee")
  })
  it("every confidence reason has a text", () => {
    const fr = JSON.parse(fs.readFileSync(path.join(root, "messages/fr.json"), "utf8")).affiliate.retentionAdvice
    for (const r of ["echantillon_limite", "categorie_seulement", "chance_non_mesurable", "echantillon_suffisant"]) expect(fr[`reason_${r}`]).toBeTruthy()
  })
  it("the note never promises a sale (no « garanti » without « pas une garantie »)", () => {
    const fr = JSON.parse(fs.readFileSync(path.join(root, "messages/fr.json"), "utf8")).affiliate.retentionAdvice as Record<string, string>
    for (const [k, v] of Object.entries(fr)) if (/garant/i.test(v)) expect(k).toBe("noGuarantee")
  })
  it("the client note imports the advisor as a type only and the dialog keeps one-click confirmation", () => {
    const note = fs.readFileSync(path.join(root, "components/affiliate/retention-advice-note.tsx"), "utf8")
    expect(note).toMatch(/import type \{ RetentionAdvice \} from "@\/lib\/reseller-copilot\/retention-advisor"/)
    expect(note).not.toMatch(/disabled=/)
    const dialog = fs.readFileSync(path.join(root, "components/affiliate/discover-listing-actions.tsx"), "utf8")
    expect(dialog).toContain("<RetentionAdviceNote listingId={pendingId} />")
    expect(dialog).toMatch(/onClick=\{\(\) => void confirmRelease\(\)\}/)
  })
  it("the route is owner-only and the server never reads another shop's listing for the reseller", () => {
    const route = fs.readFileSync(path.join(root, "app/api/affiliate/listings/[id]/retention-advice/route.ts"), "utf8")
    expect(route).toContain('role !== "AFFILIATE"')
    const server = fs.readFileSync(path.join(root, "lib/reseller-copilot/retention-advisor.server.ts"), "utf8")
    expect(server).toContain("where: { id: listingId, affiliateId }")
    expect(server).toContain("excludeAffiliateId: affiliateId")
    const ref = fs.readFileSync(path.join(root, "lib/reseller-copilot/observation-reference.server.ts"), "utf8")
    expect(ref).toContain("x.affiliateId !== excludeAffiliateId")
  })
})
