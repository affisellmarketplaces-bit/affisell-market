import { beforeEach, describe, expect, it, vi } from "vitest"

const { calls, reconcile, findUnique, updateMany } = vi.hoisted(() => {
  const calls: string[] = []
  return {
    calls,
    reconcile: vi.fn(async () => {
      calls.push("reconcile")
    }),
    findUnique: vi.fn(async () => {
      calls.push("read-order")
      return null
    }),
    updateMany: vi.fn(async () => {
      calls.push("force-clear")
      return { count: 1 }
    }),
  }
})
vi.mock("@/lib/marketplace-order-settlement-reconcile", () => ({
  reconcileMarketplaceOrderPartnerAmounts: reconcile,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findUnique, updateMany } },
}))
vi.mock("@react-email/render", () => ({ render: vi.fn() }))
vi.mock("@/emails/affiliate-new-sale-alert", () => ({ AffiliateNewSaleAlertEmail: vi.fn() }))
vi.mock("@/emails/merchant-new-order-alert", () => ({ MerchantNewOrderAlertEmail: vi.fn() }))

import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"

describe("dispatchMerchantOrderAlerts", () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
    findUnique.mockImplementation(async () => {
      calls.push("read-order")
      return null
    })
  })

  it("completes the partner amounts BEFORE reading them for the alert (no more 'Your earnings €0.00')", async () => {
    await dispatchMerchantOrderAlerts("o1")
    expect(calls.slice(0, 2)).toEqual(["reconcile", "read-order"])
  })

  it("still reads the order when the reconcile step fails", async () => {
    reconcile.mockRejectedValueOnce(new Error("db"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await dispatchMerchantOrderAlerts("o2")
    spy.mockRestore()
    expect(calls).toContain("read-order")
  })

  it("does not clear sent flags when the order is missing or unpaid", async () => {
    await dispatchMerchantOrderAlerts("o3", { forceSupplier: true, forceAffiliate: true })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("clears supplier flag only after confirming the order is paid", async () => {
    findUnique.mockImplementation(async () => {
      calls.push("read-order")
      return {
        id: "o4",
        status: "paid",
        quantity: 1,
        customerEmail: "buyer@example.com",
        variantLabel: null,
        variantImageUrl: null,
        currency: "eur",
        supplierPayoutCents: 1000,
        commissionCents: 100,
        affiliateMarginRetainedCents: 0,
        affiliateFeeCents: 0,
        buyerLocale: "fr",
        merchantSupplierEmailSentAt: new Date("2026-01-01"),
        merchantAffiliateEmailSentAt: new Date("2026-01-01"),
        product: { name: "Produit" },
        affiliate: { email: "aff@example.com", store: null },
        supplier: { email: "sup@example.com" },
      }
    })
    vi.stubEnv("RESEND_API_KEY", "")
    await dispatchMerchantOrderAlerts("o4", { forceSupplier: true })
    expect(calls.slice(0, 3)).toEqual(["reconcile", "read-order", "force-clear"])
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "o4", status: "paid" },
      data: { merchantSupplierEmailSentAt: null },
    })
  })
})
