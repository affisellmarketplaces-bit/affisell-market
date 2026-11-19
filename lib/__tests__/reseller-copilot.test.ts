import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { computePhase1OrderFees, netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { assessCandidate, buildSelection, sanitizeAddRequest, suggestedPriceHt, type SelectionCandidate } from "@/lib/reseller-copilot/selection"

describe("reseller net per sale — pinned to the REAL settlement", () => {
  it("commission + markup − Affisell's reseller fee, exactly what the transfer pays (grid)", () => {
    let checked = 0
    for (const supplier of [99, 500, 1999, 2000, 4999, 12_345, 99_999]) {
      for (const pct of [0, 5, 10, 13, 20, 35]) {
        for (const sellingFactor of [0.8, 1, 1.13, 1.3, 2]) {
          for (const feeBps of [null, 0, 1000, 1500, 2000, 3500]) {
            const selling = Math.round(supplier * sellingFactor)
            const s = computeMarketplaceOrderSettlement({ sellingPriceCents: selling, supplierPriceCents: supplier, supplierCommissionRateBps: pct * 100 } as never)
            const fees = computePhase1OrderFees({
              wholesaleTotalCents: supplier,
              affiliateCommissionCents: s.affiliateCommissionCents,
              affiliateMarginRetainedCents: s.affiliateMarginRetainedCents,
              affiliatePlatformFeeBps: feeBps,
            })
            const realNet = netAffiliateTransferCents({
              affiliatePayoutCents: s.affiliateCommissionCents,
              affiliateMarginRetainedCents: s.affiliateMarginRetainedCents,
              affiliateMarginCents: s.affiliateMarginRetainedCents,
              affiliateFeeCents: fees.affiliateFeeCents,
            })
            const mine = computeResellerNetPerSale({ supplierPriceCents: supplier, commissionRatePct: pct, sellingPriceHtCents: selling, affiliateFeeBps: feeBps })
            const tag = `${supplier} ${pct}% x${sellingFactor} fee ${feeBps}`
            expect(mine.commissionCents, tag).toBe(s.affiliateCommissionCents)
            expect(mine.markupCents, tag).toBe(s.affiliateMarginRetainedCents)
            expect(mine.affisellFeeCents, tag).toBe(fees.affiliateFeeCents)
            expect(mine.netCents, tag).toBe(realNet)
            checked += 1
          }
        }
      }
    }
    expect(checked).toBe(7 * 6 * 5 * 6)
  })

  it("says when the default fee was assumed and when the price is under the supplier's", () => {
    expect(computeResellerNetPerSale({ supplierPriceCents: 1000, commissionRatePct: 10, sellingPriceHtCents: 1300, affiliateFeeBps: null })).toMatchObject({
      commissionCents: 100,
      markupCents: 300,
      grossCents: 400,
      affisellFeeCents: 80,
      netCents: 320,
      feeBps: 2000,
      feeIsDefault: true,
      belowSupplierPrice: false,
      buyerPriceTtcEstimateCents: 1560,
    })
    expect(computeResellerNetPerSale({ supplierPriceCents: 1000, commissionRatePct: 10, sellingPriceHtCents: 900, affiliateFeeBps: 1000 })).toMatchObject({ markupCents: 0, netCents: 90, belowSupplierPrice: true, feeIsDefault: false })
  })

  it("the catalogue card now carries the net next to the gross it used to show alone", () => {
    const e = buildAffiliateCatalogCardEconomics(1000, 10)
    expect(e.totalPartnerGainCents).toBe(400)
    expect(e.netPartnerGainCents).toBe(320)
    expect(e.affisellFeeCents).toBe(80)
    expect(buildAffiliateCatalogCardEconomics(1000, 10, { affiliateFeeBps: 1000 }).netPartnerGainCents).toBe(360)
  })
})

const cand = (o: Partial<SelectionCandidate> = {}): SelectionCandidate => ({
  productId: "p1",
  name: "Lampe",
  imageUrl: null,
  basePriceCents: 2000,
  commissionRatePct: 10,
  commissionExplicit: true,
  stockUnits: 20,
  stockKnown: true,
  returnWindowDays: 14,
  paidOrders30d: 0,
  resellersListing: 0,
  inMyShop: false,
  awaitingReview: false,
  ...o,
})

describe("selection — readiness", () => {
  it("blocks what can not be sold: no explicit commission (the sale would be lost), out of stock, awaiting review", () => {
    expect(assessCandidate(cand({ commissionExplicit: false }), null)).toMatchObject({ readiness: "bloque" })
    expect(assessCandidate(cand({ stockUnits: 0 }), null).reasons[0]).toEqual({ code: "out_of_stock", qualification: "catalogue" })
    expect(assessCandidate(cand({ awaitingReview: true }), null).readiness).toBe("bloque")
    expect(assessCandidate(cand({ basePriceCents: 0 }), null).readiness).toBe("bloque")
  })
  it("flags what must be checked: stock unknown, very low stock, low net", () => {
    expect(assessCandidate(cand({ stockKnown: false }), null).readiness).toBe("a_verifier")
    expect(assessCandidate(cand({ stockUnits: 2 }), null).reasons.map((r) => r.code)).toContain("low_stock")
    expect(assessCandidate(cand({ basePriceCents: 300, commissionRatePct: 1 }), null).reasons.map((r) => r.code)).toContain("low_net_per_sale")
    expect(assessCandidate(cand(), null).readiness).toBe("pret")
  })
  it("every figure is qualified; demand is observed, never forecast", () => {
    const a = assessCandidate(cand({ paidOrders30d: 4 }), 1500)
    expect(a.demand).toEqual({ paidOrders30d: 4, resellersListing: 0, qualification: "observe" })
    expect(a.reasons.find((r) => r.code === "already_selling")?.qualification).toBe("observe")
    expect(a.net.feeIsDefault).toBe(false)
    expect(a.suggestedPriceHtCents).toBe(suggestedPriceHt(2000))
    expect(JSON.stringify(a)).not.toMatch(/forecast|prevision|monthly/i)
  })
})

describe("selection — ranking and separation", () => {
  it("ready first, then highest real net, then demand; blocked returned apart; products in the shop left out", () => {
    const r = buildSelection(
      [
        cand({ productId: "low", basePriceCents: 1000 }),
        cand({ productId: "high", basePriceCents: 5000 }),
        cand({ productId: "check", basePriceCents: 9000, stockKnown: false }),
        cand({ productId: "tie-a", basePriceCents: 2000, paidOrders30d: 1 }),
        cand({ productId: "tie-b", basePriceCents: 2000, paidOrders30d: 9 }),
        cand({ productId: "blocked", commissionExplicit: false }),
        cand({ productId: "mine", inMyShop: true, basePriceCents: 99_999 }),
      ],
      { affiliateFeeBps: null, limit: 10 }
    )
    expect(r.selection.map((s) => s.productId)).toEqual(["high", "tie-b", "tie-a", "low", "check"])
    expect(r.blocked.map((b) => b.productId)).toEqual(["blocked"])
    expect(r).toMatchObject({ considered: 7, alreadyInShop: 1 })
  })
  it("caps the selection", () => {
    const many = Array.from({ length: 80 }, (_, i) => cand({ productId: `p${i}` }))
    expect(buildSelection(many, { affiliateFeeBps: null, limit: 500 }).selection).toHaveLength(50)
  })
})

describe("adding — only clean ids, bounded", () => {
  it("refuses anything but a short list of plain ids", () => {
    expect(sanitizeAddRequest({ productIds: ["a", "a", "b"] })).toEqual(["a", "b"])
    expect(sanitizeAddRequest({ productIds: [] })).toBeNull()
    expect(sanitizeAddRequest({ productIds: ["../x"] })).toBeNull()
    expect(sanitizeAddRequest({ productIds: Array.from({ length: 21 }, (_, i) => `p${i}`) })).toBeNull()
    expect(sanitizeAddRequest(null)).toBeNull()
  })
  it("the add path re-assesses and goes through the existing quick add; the route is reseller-only, same-site and rate-limited", () => {
    const srv = readFileSync(path.resolve(__dirname, "../reseller-copilot/selection.server.ts"), "utf8")
    expect(srv).toContain("quickAddAffiliateListing")
    expect(srv).toContain("not_sellable_now")
    expect(srv).not.toMatch(/affiliateProduct\.(create|update|upsert)/)
    const route = readFileSync(path.resolve(__dirname, "../../app/api/affiliate/copilot/selection/route.ts"), "utf8")
    expect(route).toContain('role !== "AFFILIATE"')
    expect(route).toContain("assertSameSiteRequestOrigin(req)")
    expect(route).toContain("rateLimitResponseAsync")
  })
  it("the panel (client) imports only types and client-safe helpers", () => {
    const ui = readFileSync(path.resolve(__dirname, "../../components/affiliate/reseller-copilot-panel.tsx"), "utf8")
    expect(ui).toMatch(/import type \{ SelectionItem \}/)
    expect(ui).not.toMatch(/selection\.server|@\/lib\/prisma/)
  })
})
