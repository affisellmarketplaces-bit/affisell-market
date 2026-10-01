import { describe, expect, it, vi, beforeEach } from "vitest"

const { findUniqueAffiliateProduct, aggregateAffiliateProduct, findUniqueProduct } = vi.hoisted(() => ({
  findUniqueAffiliateProduct: vi.fn(),
  aggregateAffiliateProduct: vi.fn(),
  findUniqueProduct: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: {
      findUnique: findUniqueAffiliateProduct,
      aggregate: aggregateAffiliateProduct,
    },
    product: { findUnique: findUniqueProduct },
  },
}))

import { loadSponsorHtCents } from "@/lib/sponsor/sponsor-access"

describe("loadSponsorHtCents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("quotes an affiliate campaign against the listing's selling price, not wholesale", async () => {
    // Regression: the preview a payer approves before activating must match the basis actually
    // charged on a sale (buyer's paid HT price), not the supplier's wholesale cost — see
    // lib/stripe-marketplace-fulfill.ts's clientLineHtCents.
    findUniqueAffiliateProduct.mockResolvedValue({ sellingPriceCents: 2500 })
    const htCents = await loadSponsorHtCents({
      payerRole: "AFFILIATE",
      productId: "p1",
      affiliateProductId: "ap1",
    })
    expect(htCents).toBe(2500)
    expect(findUniqueProduct).not.toHaveBeenCalled()
  })

  it("quotes a supplier campaign against the average live listing price when one exists", async () => {
    aggregateAffiliateProduct.mockResolvedValue({ _avg: { sellingPriceCents: 3120.6 } })
    const htCents = await loadSponsorHtCents({ payerRole: "SUPPLIER", productId: "p1" })
    expect(htCents).toBe(3121)
    expect(findUniqueProduct).not.toHaveBeenCalled()
  })

  it("falls back to wholesale cost for a supplier product with no live listings", async () => {
    aggregateAffiliateProduct.mockResolvedValue({ _avg: { sellingPriceCents: null } })
    findUniqueProduct.mockResolvedValue({ basePriceCents: 1999 })
    const htCents = await loadSponsorHtCents({ payerRole: "SUPPLIER", productId: "p1" })
    expect(htCents).toBe(1999)
  })
})
