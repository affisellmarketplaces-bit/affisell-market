import { beforeEach, describe, expect, it, vi } from "vitest"

const { needs, ensure } = vi.hoisted(() => ({ needs: vi.fn(), ensure: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: vi.fn() } } }))
vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  marketplaceCheckoutNeedsFulfillment: needs,
  ensureMarketplaceCheckoutFulfilled: ensure,
}))

import { ensureCheckoutFulfilledBeforeSettle } from "@/lib/marketplace-checkout-fulfill-before-settle"

const paid = { id: "cs_1", mode: "payment", payment_status: "paid" } as never

describe("ensureCheckoutFulfilledBeforeSettle", () => {
  beforeEach(() => {
    needs.mockReset()
    ensure.mockReset().mockResolvedValue(undefined)
  })

  it("fulfils the checkout first when the order rows still need it (payment_intent arrived before the session)", async () => {
    needs.mockResolvedValue(true)
    expect(await ensureCheckoutFulfilledBeforeSettle(paid)).toBe(true)
    expect(ensure).toHaveBeenCalledWith(paid)
  })

  it("does nothing when the checkout is already fulfilled", async () => {
    needs.mockResolvedValue(false)
    expect(await ensureCheckoutFulfilledBeforeSettle(paid)).toBe(false)
    expect(ensure).not.toHaveBeenCalled()
  })

  it("ignores unpaid sessions and non-payment modes", async () => {
    expect(await ensureCheckoutFulfilledBeforeSettle({ id: "x", mode: "payment", payment_status: "unpaid" } as never)).toBe(false)
    expect(await ensureCheckoutFulfilledBeforeSettle({ id: "x", mode: "subscription", payment_status: "paid" } as never)).toBe(false)
    expect(needs).not.toHaveBeenCalled()
  })
})

describe("ensureCheckoutFulfilledForPaymentIntent (runs before the webhook DB transaction)", () => {
  it("never throws and skips blind-dropship payment intents", async () => {
    const { ensureCheckoutFulfilledForPaymentIntent } = await import("@/lib/marketplace-checkout-fulfill-before-settle")
    await expect(
      ensureCheckoutFulfilledForPaymentIntent({ id: "pi_1", metadata: { flow: "blind_dropship" } } as never)
    ).resolves.toBeUndefined()
    expect(ensure).not.toHaveBeenCalled()
  })
})
