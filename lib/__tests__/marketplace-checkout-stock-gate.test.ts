/**
 * G1 — the stock is checked BEFORE the payment session exists (409, nothing created), for the cart checkout and the
 * single-line checkout. The authoritative atomic decrement is covered by `fulfil-unallocated-and-stock.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  orderCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  ghostGate: vi.fn(),
  similar: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findFirst: m.findFirst },
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

describe("cart checkout", () => {
  it("a sold-out product never reaches the payment: 409, no session, supplier probe not even called", async () => {
    listings.a = listing("a", { stock: 0 })
    m.similar.mockResolvedValue([{ affiliateProductId: "x", title: "Alt", image: null, priceCents: 1900, href: "/shops/x" }])

    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: "OUT_OF_STOCK", // Affisell's own code: OUT_OF_STOCK_VERIFIED is the supplier-probe refusal ("we just checked with our supplier")
      productName: "Product a",
      availableQty: 0,
      requestedQty: 1,
      alternatives: [expect.objectContaining({ affiliateProductId: "x" })],
    })
    expect(m.sessionsCreate).not.toHaveBeenCalled()
    expect(m.ghostGate).not.toHaveBeenCalled()
  })

  it("asking for more than is left says how many are left", async () => {
    listings.a = listing("a", { stock: 2 })
    const res = await checkout({ items: [{ productId: "a", qty: 5 }] })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "INSUFFICIENT_STOCK", availableQty: 2, requestedQty: 5 })
    expect(m.sessionsCreate).not.toHaveBeenCalled()
  })

  it("two lines of the same product are counted together", async () => {
    listings.a = listing("a", { stock: 3 })
    const res = await checkout({
      items: [
        { productId: "a", qty: 2 },
        { productId: "a", qty: 2, selectedColor: "Rouge" },
      ],
    })
    expect(res.status).toBe(409)
    expect(m.sessionsCreate).not.toHaveBeenCalled()
  })

  it("a variant that is sold out is refused even when the product total is not zero", async () => {
    listings.a = listing("a", {
      stock: 9,
      variants: {
        variantRows: [
          { id: "r1", name: "Rouge / S", sku: "", priceCents: 0, stock: 0, commission: 20, sales: 0 },
          { id: "r2", name: "Rouge / M", sku: "", priceCents: 0, stock: 9, commission: 20, sales: 0 },
        ],
      },
    })
    const res = await checkout({ items: [{ productId: "a", qty: 1, selectedColor: "Rouge", selectedSize: "S" }] })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "OUT_OF_STOCK", availableQty: 0 })
  })

  it("enough stock: the checkout goes on to Stripe as before", async () => {
    listings.a = listing("a", { stock: 5 })
    const res = await checkout({ items: [{ productId: "a", qty: 5 }] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.test/cs_new" })
    expect(m.sessionsCreate).toHaveBeenCalledTimes(1)
  })

  it("products whose stock is not managed are never refused (digital goods keep selling at 0)", async () => {
    listings.a = listing("a", { stock: 0, listingKind: "SOFTWARE" })
    const res = await checkout({ items: [{ productId: "a", qty: 3 }] })
    expect(res.status).toBe(200)
  })

  it("5 in stock, a cart asking 5 + 1: told that 5 are left (not 'out of stock'), 6 requested", async () => {
    listings.a = listing("a", { stock: 5 })
    const res = await checkout({
      items: [
        { productId: "a", qty: 5 },
        { productId: "a", qty: 1, selectedColor: "Rouge" },
      ],
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ error: "INSUFFICIENT_STOCK", availableQty: 5, requestedQty: 6 })
    // no hard-coded (English-only) sentence: the front end translates from the code
    expect(body.message).toBeUndefined()
  })

  it("a product with variants only in the ProductVariant table is never refused (its stock is not the aggregate)", async () => {
    listings.a = listing("a", { stock: 0, hasVariants: true, variants: null })
    const res = await checkout({ items: [{ productId: "a", qty: 1, selectedColor: "Rouge", selectedSize: "M" }] })
    expect(res.status).toBe(200)
  })

  it("CHECKOUT_STOCK_GUARD=off disables the check", async () => {
    process.env.CHECKOUT_STOCK_GUARD = "off"
    listings.a = listing("a", { stock: 0 })
    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })
    expect(res.status).toBe(200)
  })
})

describe("single-line checkout", () => {
  it("a sold-out product is refused BEFORE the pending order and the payment session are created", async () => {
    listings.a = listing("a", { stock: 0 })
    const res = await checkout({ affiliateProductId: "a", qty: 1 })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "OUT_OF_STOCK", productName: "Product a" })
    expect(m.orderCreate).not.toHaveBeenCalled()
    expect(m.sessionsCreate).not.toHaveBeenCalled()
  })

  it("a quantity above the stock is refused with the remaining quantity", async () => {
    listings.a = listing("a", { stock: 1 })
    const res = await checkout({ affiliateProductId: "a", qty: 2 })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "INSUFFICIENT_STOCK", availableQty: 1, requestedQty: 2 })
    expect(m.orderCreate).not.toHaveBeenCalled()
  })

  it("enough stock: pending order and payment session are created as before", async () => {
    listings.a = listing("a", { stock: 2 })
    const res = await checkout({ affiliateProductId: "a", qty: 2 })
    expect(res.status).toBe(200)
    expect(m.orderCreate).toHaveBeenCalledTimes(1)
    expect(m.sessionsCreate).toHaveBeenCalledTimes(1)
  })
})

describe("CHECKOUT_STOCK_MODE: warn (the default) logs and lets the buyer through, enforce refuses, off does nothing", () => {
  const sessionsBefore = () => m.sessionsCreate.mock.calls.length

  it("the DEFAULT is warn: a sold-out product still reaches the payment, 'would refuse' is logged, nothing is refused", async () => {
    delete process.env.CHECKOUT_STOCK_MODE
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    listings.a = listing("a", { stock: 0 })
    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })
    expect(res.status).toBe(200)
    expect(sessionsBefore()).toBe(1)
    expect(log.mock.calls.some((c) => c[0] === "[checkout]" && (c[1] as { result?: string }).result === "would_refuse_insufficient_stock")).toBe(true)
    log.mockRestore()
  })

  it("warn also covers the single-line checkout: the pending order and the session are created", async () => {
    delete process.env.CHECKOUT_STOCK_MODE
    listings.a = listing("a", { stock: 0 })
    const res = await checkout({ affiliateProductId: "a", qty: 1 })
    expect(res.status).toBe(200)
    expect(m.orderCreate).toHaveBeenCalledTimes(1)
  })

  it("off: neither refusal nor log", async () => {
    process.env.CHECKOUT_STOCK_MODE = "off"
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    listings.a = listing("a", { stock: 0 })
    const res = await checkout({ items: [{ productId: "a", qty: 1 }] })
    expect(res.status).toBe(200)
    expect(log.mock.calls.some((c) => String((c[1] as { result?: string })?.result).includes("refuse"))).toBe(false)
    log.mockRestore()
  })
})
