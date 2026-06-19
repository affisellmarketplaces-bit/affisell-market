import { beforeEach, describe, expect, it, vi } from "vitest"

const { reconcilePartnerPendingCheckoutOrders, healRecentPartnerMarketplaceNotifications } =
  vi.hoisted(() => ({
    reconcilePartnerPendingCheckoutOrders: vi.fn(),
    healRecentPartnerMarketplaceNotifications: vi.fn(),
  }))

vi.mock("@/lib/cron/reconcile-partner-pending-checkouts", () => ({
  reconcilePartnerPendingCheckoutOrders,
}))

vi.mock("@/lib/marketplace-order-notification-heal", () => ({
  healRecentPartnerMarketplaceNotifications,
}))

import { syncPartnerMarketplaceAlertsBeforeInbox } from "@/lib/marketplace-order-notification-sync"

describe("syncPartnerMarketplaceAlertsBeforeInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reconciles paid checkouts before healing inbox rows", async () => {
    const callOrder: string[] = []
    reconcilePartnerPendingCheckoutOrders.mockImplementation(async () => {
      callOrder.push("reconcile")
      return { scanned: 1, healed: 1 }
    })
    healRecentPartnerMarketplaceNotifications.mockImplementation(async () => {
      callOrder.push("heal")
      return { scanned: 2, healed: 1 }
    })

    const result = await syncPartnerMarketplaceAlertsBeforeInbox({ supplierId: "sup_1" })

    expect(callOrder).toEqual(["reconcile", "heal"])
    expect(result).toEqual({
      reconcile: { scanned: 1, healed: 1 },
      heal: { scanned: 2, healed: 1 },
    })
  })
})
