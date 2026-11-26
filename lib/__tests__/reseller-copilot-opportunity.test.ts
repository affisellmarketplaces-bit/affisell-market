/**
 * Reseller copilot — « pourquoi cette opportunité ? » (founder brief 2026-11-23): situations by rule, absence of data never
 * read as weak performance, the reseller's OWN fee, availability risks qualified, category strength scoped, the ranking
 * explained by its own criteria, nothing confidential in the output.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { assessOpportunity, categoryStanding, coverDays, priceBandOf, type OpportunityInput } from "@/lib/reseller-copilot/opportunity"
import { buildSelection, LOW_NET_CENTS, suggestedPriceHt, type SelectionCandidate } from "@/lib/reseller-copilot/selection"

const netAt = (base: number, pct: number, fee: number | null = null) =>
  computeResellerNetPerSale({ supplierPriceCents: base, commissionRatePct: pct, sellingPriceHtCents: suggestedPriceHt(base), affiliateFeeBps: fee })

const input = (over: Partial<OpportunityInput> = {}): OpportunityInput => ({
  readiness: "pret",
  net: netAt(4000, 15),
  lowNetCents: LOW_NET_CENTS,
  paidOrders30d: 0,
  units30d: 0,
  resellersListing: 3,
  rising: false,
  stockUnits: 40,
  stockKnown: true,
  ageDays: 60,
  offerMissingMeasured: [],
  category: null,
  priceBand: null,
  fit: null,
  ...over,
})
const codes = (fs: Array<{ code: string }>) => fs.map((f) => f.code)

describe("situations, by rule", () => {
  it("strong demand but low net / low net / profitable and validated / too recent / demand to build", () => {
    const low = netAt(500, 5)
    expect(low.netCents).toBeLessThan(LOW_NET_CENTS)
    expect(assessOpportunity(input({ net: low, paidOrders30d: 8 })).profile).toBe("forte_demande_gain_faible")
    expect(assessOpportunity(input({ net: low, rising: true })).profile).toBe("forte_demande_gain_faible")
    expect(assessOpportunity(input({ net: low })).profile).toBe("gain_faible")
    expect(assessOpportunity(input({ paidOrders30d: 5 })).profile).toBe("rentable_valide")
    expect(assessOpportunity(input({ ageDays: 10 })).profile).toBe("prometteur_peu_de_donnees")
    expect(assessOpportunity(input({ paidOrders30d: 2 })).profile).toBe("rentable_demande_a_construire")
  })

  it("an absence of data is never weak performance: a new product without orders is « too early », not « no sales »", () => {
    const o = assessOpportunity(input({ ageDays: 5, paidOrders30d: 0 }))
    expect(o.profile).toBe("prometteur_peu_de_donnees")
    expect(codes(o.missing)).toContain("too_recent")
    expect(codes(o.missing)).not.toContain("no_sales_yet")
    expect(o.risks.every((r) => r.qualification !== "insuffisant")).toBe(true)
    expect(o.missing.every((m) => m.qualification === "insuffisant")).toBe(true)
    expect(assessOpportunity(input({ offerMissingMeasured: null })).missing.map((m) => m.code)).toContain("offer_not_measured")
  })

  it("a new product is not pushed down by the ranking for lacking history (ranked by net, then demand)", () => {
    const c = (id: string, base: number, orders: number, age: number): SelectionCandidate => ({
      productId: id, name: id, imageUrl: null, basePriceCents: base, commissionRatePct: 15, commissionExplicit: true, stockUnits: 50, stockKnown: true,
      returnWindowDays: 14, paidOrders30d: orders, resellersListing: 2, inMyShop: false, awaitingReview: false, ageDays: age,
    })
    const { selection } = buildSelection([c("old-seller", 3000, 20, 200), c("new-better-net", 6000, 0, 3)], { affiliateFeeBps: null, limit: 5 })
    expect(selection.map((s) => s.productId)).toEqual(["new-better-net", "old-seller"])
    expect(selection[0].opportunity?.profile).toBe("prometteur_peu_de_donnees")
    expect(selection[0].opportunity?.rankedAbove).toMatchObject({ productId: "old-seller", criterion: "net" })
  })
})

describe("what a sale really pays", () => {
  it("the breakdown is the settlement-pinned net, at the reseller's own fee when it has one, the default said otherwise", () => {
    const mine = assessOpportunity(input({ net: netAt(4000, 15, 1200) }))
    expect(mine.earnings).toMatchObject({ feeBps: 1200, feeIsDefault: false, qualification: "calcul" })
    expect(mine.earnings.commissionCents + mine.earnings.markupCents - mine.earnings.affisellFeeCents).toBe(mine.earnings.netCents)
    const def = assessOpportunity(input())
    expect(def.earnings.feeIsDefault).toBe(true)
    expect(codes(def.missing)).toContain("fee_default")
  })
})

describe("risks and strengths", () => {
  it("availability: ≤ 3 units is a fact; a short cover is an ESTIMATE that needs ≥ 5 units sold", () => {
    expect(assessOpportunity(input({ stockUnits: 2 })).risks.find((r) => r.code === "low_stock")?.qualification).toBe("fait")
    expect(coverDays(10, 30)).toBe(10)
    const short = assessOpportunity(input({ stockUnits: 10, units30d: 30 }))
    expect(short.flags).toContain("risque_disponibilite")
    expect(short.risks.find((r) => r.code === "short_cover")?.qualification).toBe("estimation")
    expect(coverDays(10, 4)).toBeNull()
    expect(codes(assessOpportunity(input({ stockUnits: 10, units30d: 4 })).missing)).toContain("cover_not_projectable")
    expect(assessOpportunity(input({ stockUnits: 10, units30d: 30 })).action).toBe("ajouter_surveiller_stock")
  })
  it("distribution: little competition is a strength, many resellers a risk", () => {
    expect(assessOpportunity(input({ resellersListing: 0 })).flags).toContain("sous_distribue")
    expect(assessOpportunity(input({ resellersListing: 12 })).flags).toContain("tres_distribue")
  })
  it("category strength is scoped to its category and needs ≥ 5 comparable products", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => ({ productId: id, categoryId: "cat", paidOrders30d: 8 - i }))
    const st = categoryStanding(items, new Map([["cat", "Lampes"]]))
    expect(st.get("a")).toEqual({ name: "Lampes", peers: 8, topQuarter: true })
    expect(st.get("h")?.topQuarter).toBe(false)
    expect(categoryStanding(items.slice(0, 4), new Map()).size).toBe(0)
    const o = assessOpportunity(input({ paidOrders30d: 3, category: st.get("a")! }))
    expect(o.strengths.find((s) => s.code === "strong_in_category")?.params).toMatchObject({ category: "Lampes", peers: 8 })
  })
  it("its usual price range comes from its own listings (≥ 5)", () => {
    expect(priceBandOf([1000, 2000, 3000])).toBeNull()
    expect(priceBandOf([1000, 2000, 3000, 4000, 5000])).toEqual({ p25: 2000, p75: 4000 })
    const net = netAt(4000, 15)
    expect(assessOpportunity(input({ priceBand: { p25: 1000, p75: 2000 }, net })).flags).toContain("hors_votre_gamme")
  })
  it("a low net leads to « decide knowingly », never to a price recommendation", () => {
    const o = assessOpportunity(input({ net: netAt(500, 5), paidOrders30d: 9 }))
    expect(o.action).toBe("decider_sur_le_gain")
    expect(JSON.stringify(o)).not.toMatch(/recommendedPrice|suggestedPriceChange/)
  })
})

describe("ranking explained by itself", () => {
  it("category affinity is named when a lower net is placed first because of the reseller's categories", () => {
    const c = (id: string, base: number, cat: string): SelectionCandidate => ({
      productId: id, name: id, imageUrl: null, basePriceCents: base, commissionRatePct: 15, commissionExplicit: true, stockUnits: 50, stockKnown: true,
      returnWindowDays: 14, paidOrders30d: 0, resellersListing: 2, inMyShop: false, awaitingReview: false, categoryId: cat, ageDays: 90,
    })
    const { selection } = buildSelection([c("mine", 4000, "own"), c("other", 4200, "x"), c("other2", 1000, "y")], { affiliateFeeBps: null, limit: 3, myCategories: new Set(["own"]) })
    const mine = selection.find((s) => s.productId === "mine")!
    expect(selection.indexOf(mine)).toBeLessThan(selection.findIndex((s) => s.productId === "other"))
    expect(mine.opportunity?.rankedAbove?.criterion).toBe("category_affinity")
  })
})

describe("confidentiality and boundaries", () => {
  it("the opportunity carries no supplier cost, no supplier or reseller identity", () => {
    const keys = new Set<string>()
    const walk = (v: unknown) => {
      if (!v || typeof v !== "object") return
      for (const [k, x] of Object.entries(v)) {
        keys.add(k)
        walk(x)
      }
    }
    walk(assessOpportunity(input({ category: { name: "Lampes", peers: 8, topQuarter: true }, paidOrders30d: 4, priceBand: { p25: 1, p75: 9 } })))
    for (const k of keys) expect(k).not.toMatch(/supplier(Id|Email|Cost)|affiliateId|email|cost|margin|leadTime|unitCost/i)
  })
  it("the server reads no supplier cost, no supplier contact and no other reseller's prices", () => {
    const src = readFileSync(join(process.cwd(), "lib/reseller-copilot/selection.server.ts"), "utf8")
    expect(src).not.toMatch(/supplier-costs|supplier-cost:|supplierEmail|supplier:\s*\{\s*select:\s*\{\s*email/)
    // Selling prices are read only from the reseller's OWN listings.
    expect(src).toMatch(/where: \{ affiliateId, isListed: true \}, select: \{ sellingPriceCents: true \}/)
  })
  it("the panel imports only types from the engine", () => {
    const panel = readFileSync(join(process.cwd(), "components/affiliate/reseller-copilot-panel.tsx"), "utf8")
    expect(panel).toMatch(/import type \{ Fact, Opportunity \} from "@\/lib\/reseller-copilot\/opportunity"/)
  })
})

describe("texts", () => {
  it("every code the engine can say exists in 8 locales", () => {
    const src = readFileSync(join(process.cwd(), "lib/reseller-copilot/opportunity.ts"), "utf8")
    const facts = [...new Set([...src.matchAll(/code: (?:i\.readiness === "pret" \? )?"([a-z_]+)"(?: : "([a-z_]+)")?/g)].flatMap((m) => [m[1], m[2]]).filter(Boolean))] as string[]
    const ternaries = [...src.matchAll(/code: [^"]*\? "([a-z_]+)" : "([a-z_]+)"/g)].flatMap((m) => [m[1], m[2]])
    const all = [...new Set([...facts, ...ternaries])]
    expect(all.length).toBeGreaterThanOrEqual(25)
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const o = JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8")).affiliate.copilot.opportunity
      for (const c of all) expect(typeof o.fact[c], `${loc} fact.${c}`).toBe("string")
      for (const p of ["forte_demande_gain_faible", "gain_faible", "rentable_valide", "prometteur_peu_de_donnees", "rentable_demande_a_construire"]) {
        expect(typeof o.profile[p].title, `${loc} ${p}`).toBe("string")
      }
      for (const a of ["ajouter", "ajouter_surveiller_stock", "decider_sur_le_gain", "tester_avant_de_promouvoir"]) expect(typeof o.action[a]).toBe("string")
      for (const r of ["readiness", "rising", "net", "category_affinity", "demand", "tie"]) expect(typeof o.rank[r]).toBe("string")
      for (const q of ["fait", "calcul", "estimation", "insuffisant"]) expect(typeof o.qualification[q]).toBe("string")
    }
    const fr = JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")).affiliate.copilot.opportunity
    expect(fr.honesty).toMatch(/ni prévision ni garantie/)
    expect(fr.fact.strong_in_category).toMatch(/pas forcément ailleurs/)
  })
})
