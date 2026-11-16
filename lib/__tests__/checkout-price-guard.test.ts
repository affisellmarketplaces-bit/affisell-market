/**
 * A listing is never sold below the supplier's CURRENT price (lib/checkout-price-guard.ts): 409
 * PRICE_BELOW_SUPPLIER_PRICE before any order or payment session, listing flagged for its reseller.
 * (Mocks shared with marketplace-checkout-stock-gate.test.ts.)
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  orderCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  ghostGate: vi.fn(),
  similar: vi.fn(),
  flag: vi.fn(async () => ({ count: 1 })),
}))

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findFirst: m.findFirst, updateMany: m.flag },
    user: { findUnique: vi.fn(async () => null) },
    order: { create: m.orderCreate, update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ order: { create: m.orderCreate } }),
  },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ checkout: { sessions: { create: m.sessionsCreate } } }) }))
vi.mock("@/lib/ghost/checkout-gate", () => ({ assertGhostStockForCheckout: m.ghostGate }))
vi.mock("@/lib/ghost/ensure-ghost-schema", () => ({ ensureGhostStockSchema: vi.fn(async () => {}) }))
vi.mock("@/lib/ghost/similar-products", () => ({ getSimilarInStockProducts: m.similar }))
vi.mock("@/lib/pulse/battle-engine", () => ({ applyBattleFlashUnitCents: vi.fn(), resolveActiveBattleFlash: vi.fn(async () => null) }))
vi.mock("@/lib/pulse/battle-price-history", () => ({ recordListingPriceHistory: vi.fn(async () => {}) }))
vi.mock("@/lib/affisell-platform-commission.server", () => ({ resolveAffisellCommissionRateBpsForProductId: vi.fn(async () => 500) }))
vi.mock("@/lib/supplier-commission-rate.server", () => ({ resolveSupplierCommissionRateBpsForProductId: vi.fn(async () => 2000) }))
vi.mock("@/lib/checkout-base-url", () => ({ resolveCheckoutBaseUrl: () => "http://localhost:3001" }))
vi.mock("@/lib/checkout-country-rollout", () => ({ resolveStripeCheckoutAllowedCountries: vi.fn(async () => ["FR"]) }))
vi.mock("@/lib/resolve-request-locale", () => ({ resolveRequestLocale: vi.fn(async () => "en") }))
vi.mock("@/lib/booking/checkout-validation", () => ({
  validateBookableListingCheckout: vi.fn(async () => null),
  validateBookingCartLine: vi.fn(() => null),
}))
vi.mock("@/lib/booking/slot-hold", () => ({
  reserveBookingSlotHoldInTransaction: vi.fn(async () => ({ ok: true })),
  releaseBookingSlotHoldForOrder: vi.fn(async () => {}),
}))
vi.mock("@/lib/marketplace-checkout-payment-methods", () => ({
  marketplaceCheckoutPaymentSessionOptionsForAmount: () => ({ payment_method_types: ["card"] }),
}))
vi.mock("@/lib/marketplace-stripe-checkout", () => ({
  buildHtLineItem: (a: { name: string }) => ({ name: a.name }),
  marketplaceCheckoutCgvConsentOptions: () => ({}),
  marketplaceCheckoutTaxOptions: () => ({}),
}))

import { marketplaceCheckoutPOST } from "@/lib/marketplace-checkout"

function listing(id: string, productOver: Record<string, unknown> = {}) {
  return {
    id,
    sellingPriceCents: 2000,
    marginCents: 500,
    variantPricing: null,
    customTitle: null,
    customImages: [],
    affiliate: { id: "aff1", stripeAccountId: null },
    product: {
      id: `prod_${id}`,
      name: `Product ${id}`,
      supplierId: "sup1",
      active: true,
      stock: 5,
      listingKind: "PHYSICAL",
      variants: null,
      commissionRate: 20,
      offerMode: "STANDARD",
      minOrderQuantity: 1,
      basePriceCents: 1000,
      images: [],
      deliveryCountryCodes: [],
      bookingSeatLayout: null,
      ...productOver,
    },
  }
}

function checkout(body: Record<string, unknown>) {
  return marketplaceCheckoutPOST(
    new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify(body) })
  )
}

const listings: Record<string, ReturnType<typeof listing>> = {}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(listings)) delete listings[k]
  delete process.env.CHECKOUT_STOCK_GUARD
  // the refusals below are the ENFORCE behaviour; the default (warn) has its own describe
  process.env.CHECKOUT_STOCK_MODE = "enforce"
  m.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => listings[where.id] ?? null)
  m.ghostGate.mockResolvedValue({ stock: { status: "in_stock" } })
  m.similar.mockResolvedValue([])
  m.orderCreate.mockResolvedValue({ id: "o_1" })
  m.sessionsCreate.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.test/cs_new" })
})

import { isPricedBelowSupplierPrice } from "@/lib/checkout-price-guard"

describe("isPricedBelowSupplierPrice", () => {
  it("only when the selling price is strictly below a known supplier price", () => {
    expect(isPricedBelowSupplierPrice({ unitSellingCents: 999, unitSupplierCents: 1000 })).toBe(true)
    expect(isPricedBelowSupplierPrice({ unitSellingCents: 1000, unitSupplierCents: 1000 })).toBe(false)
    expect(isPricedBelowSupplierPrice({ unitSellingCents: 500, unitSupplierCents: 0 })).toBe(false) // unknown price: other guards
  })
})

describe("checkout refuses a listing priced below the supplier's current price", () => {
  it("cart: 409, no order, no payment session, listing flagged for review", async () => {
    listings.a = listing("a", { basePriceCents: 2500 }) // supplier raised the price above the 20,00 listing
    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "PRICE_BELOW_SUPPLIER_PRICE" })
    expect(m.orderCreate).not.toHaveBeenCalled()
    expect(m.sessionsCreate).not.toHaveBeenCalled()
    expect(m.flag).toHaveBeenCalledWith({
      where: { id: "a", marginReviewNeeded: false },
      data: { marginReviewNeeded: true, marginReviewAt: expect.any(Date) },
    })
  })

  it("single-line checkout: same refusal", async () => {
    listings.a = listing("a", { basePriceCents: 2500 })
    const res = await checkout({ affiliateProductId: "a", qty: 1 })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "PRICE_BELOW_SUPPLIER_PRICE" })
    expect(m.sessionsCreate).not.toHaveBeenCalled()
  })

  it("a variant priced above the base by the supplier is compared with ITS price", async () => {
    listings.a = listing("a", {
      basePriceCents: 1000,
      variants: { colors: ["Rouge"], variantRows: [{ id: "r1", name: "Rouge", priceCents: 1500, stock: 5, commission: 20 }] },
    })
    // the listing price follows the variant's wholesale delta (+5,00): 25,00 >= 15,00 → allowed
    const res = await checkout({ items: [{ productId: "a", qty: 1, selectedColor: "Rouge" }] })
    expect(((await res.json()) as { error?: string }).error).not.toBe("PRICE_BELOW_SUPPLIER_PRICE")
    expect(m.flag).not.toHaveBeenCalled()
  })

  it("a listing at or above the supplier price is not affected", async () => {
    listings.a = listing("a", { basePriceCents: 2000 })
    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })
    expect(((await res.json()) as { error?: string }).error).not.toBe("PRICE_BELOW_SUPPLIER_PRICE")
    expect(m.flag).not.toHaveBeenCalled()
  })
})
