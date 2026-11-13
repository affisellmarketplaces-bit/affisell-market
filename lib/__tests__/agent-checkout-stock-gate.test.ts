/**
 * F10 — the /agent checkout created payment sessions with NO stock gate, yet its paid sessions reach the stock decrement
 * of the fulfilment: the buyer paid and no order was created. It now goes through the same gate as the marketplace checkout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sessionsCreate: vi.fn(),
  trackCreate: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { affiliateProduct: { findFirst: m.findFirst }, affisellTrackEvent: { create: m.trackCreate } },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ checkout: { sessions: { create: m.sessionsCreate } } }) }))
vi.mock("@/lib/ghost/ensure-ghost-schema", () => ({ ensureGhostStockSchema: vi.fn(async () => {}) }))
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "http://localhost:3001" }))

import { createCheckoutSession } from "@/lib/agent-checkout"

const listing = (productOver: Record<string, unknown> = {}) => ({
  id: "ap1",
  productId: "p1",
  sellingPriceCents: 2000,
  customTitle: null,
  customImages: [],
  product: { id: "p1", name: "Lamp", images: [], stock: 3, variants: null, hasVariants: false, listingKind: "PHYSICAL", ...productOver },
})

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.CHECKOUT_STOCK_GUARD
  process.env.CHECKOUT_STOCK_MODE = "enforce"
  m.sessionsCreate.mockResolvedValue({ id: "cs_agent", url: "https://checkout.stripe.test/cs_agent" })
  m.trackCreate.mockResolvedValue({})
})

describe("agent checkout stock gate", () => {
  it("enforce: a sold-out product never gets a payment session", async () => {
    m.findFirst.mockResolvedValue(listing({ stock: 0 }))
    const res = await createCheckoutSession("ap1")
    expect(res).toEqual({ checkoutUrl: null, reason: "out_of_stock", name: "Lamp" })
    expect(m.sessionsCreate).not.toHaveBeenCalled()
    expect(m.trackCreate).not.toHaveBeenCalled()
  })

  it("enforce: a product in stock gets its session as before", async () => {
    m.findFirst.mockResolvedValue(listing({ stock: 1 }))
    const res = await createCheckoutSession("ap1")
    expect(res).toMatchObject({ checkoutUrl: "https://checkout.stripe.test/cs_agent", productId: "p1", priceCents: 2000 })
    expect(m.sessionsCreate).toHaveBeenCalledTimes(1)
  })

  it("warn (the default): logs would-refuse and still creates the session", async () => {
    delete process.env.CHECKOUT_STOCK_MODE
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    m.findFirst.mockResolvedValue(listing({ stock: 0 }))
    const res = await createCheckoutSession("ap1")
    expect(res).toMatchObject({ checkoutUrl: "https://checkout.stripe.test/cs_agent" })
    expect(log.mock.calls.some((c) => (c[1] as { result?: string })?.result === "would_refuse_insufficient_stock")).toBe(true)
    log.mockRestore()
  })

  it("products whose stock is not managed (digital, table-only variants) are never refused", async () => {
    m.findFirst.mockResolvedValue(listing({ stock: 0, listingKind: "SOFTWARE" }))
    expect(await createCheckoutSession("ap1")).toMatchObject({ checkoutUrl: expect.any(String) })
    m.findFirst.mockResolvedValue(listing({ stock: 0, hasVariants: true }))
    expect(await createCheckoutSession("ap1")).toMatchObject({ checkoutUrl: expect.any(String) })
  })

  it("off (and the emergency valve) do nothing", async () => {
    m.findFirst.mockResolvedValue(listing({ stock: 0 }))
    process.env.CHECKOUT_STOCK_MODE = "off"
    expect(await createCheckoutSession("ap1")).toMatchObject({ checkoutUrl: expect.any(String) })
    process.env.CHECKOUT_STOCK_MODE = "enforce"
    process.env.CHECKOUT_STOCK_GUARD = "off"
    expect(await createCheckoutSession("ap1")).toMatchObject({ checkoutUrl: expect.any(String) })
  })
})
