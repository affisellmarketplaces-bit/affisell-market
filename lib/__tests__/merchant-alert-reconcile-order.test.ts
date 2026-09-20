import { beforeEach, describe, expect, it, vi } from "vitest"

const { calls, reconcile, findUnique } = vi.hoisted(() => {
  const calls: string[] = []
  return {
    calls,
    reconcile: vi.fn(async () => { calls.push("reconcile") }),
    findUnique: vi.fn(async () => { calls.push("read-order"); return null }),
  }
})
vi.mock("@/lib/marketplace-order-settlement-reconcile", () => ({ reconcileMarketplaceOrderPartnerAmounts: reconcile }))
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique, updateMany: vi.fn() } } }))
vi.mock("@react-email/render", () => ({ render: vi.fn() }))
vi.mock("@/emails/affiliate-new-sale-alert", () => ({ AffiliateNewSaleAlertEmail: vi.fn() }))
vi.mock("@/emails/merchant-new-order-alert", () => ({ MerchantNewOrderAlertEmail: vi.fn() }))

import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"

describe("dispatchMerchantOrderAlerts", () => {
  beforeEach(() => { calls.length = 0 })

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
})
