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

import {
  resetPartnerMarketplaceAlertSyncThrottleForTests,
  syncPartnerMarketplaceAlertsBeforeInbox,
  syncPartnerMarketplaceAlertsBeforeInboxIfDue,
} from "@/lib/marketplace-order-notification-sync"

describe("syncPartnerMarketplaceAlertsBeforeInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPartnerMarketplaceAlertSyncThrottleForTests()
  })

  it("reconciles paid checkouts before healing inbox rows", async () => {
    const callOrder: string[] = []
    reconcilePartnerPendingCheckoutOrders.mockImplementation(async () => {
      callOrder.push("reconcile")
      return { scanned: 1, healed: 1 }
    })
    healRecentPartnerMarketplaceNotifications.mockImplementation(async () => {
      callOrder.push("heal")
      return { scanned: 2, healed: 1, refreshed: 0 }
    })

    const result = await syncPartnerMarketplaceAlertsBeforeInbox({ supplierId: "sup_1" })

    expect(callOrder).toEqual(["reconcile", "heal"])
    expect(result).toEqual({
      reconcile: { scanned: 1, healed: 1 },
      heal: { scanned: 2, healed: 1, refreshed: 0 },
    })
  })

  it("skips heavy sync when polled again within the throttle window", async () => {
    reconcilePartnerPendingCheckoutOrders.mockResolvedValue({ scanned: 0, healed: 0 })
    healRecentPartnerMarketplaceNotifications.mockResolvedValue({ scanned: 0, healed: 0, refreshed: 0 })

    await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ affiliateId: "aff_1" })
    const skipped = await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ affiliateId: "aff_1" })

    expect(skipped).toBeNull()
    expect(reconcilePartnerPendingCheckoutOrders).toHaveBeenCalledTimes(1)
    expect(healRecentPartnerMarketplaceNotifications).toHaveBeenCalledTimes(1)
  })

  it("forces sync when requested", async () => {
    reconcilePartnerPendingCheckoutOrders.mockResolvedValue({ scanned: 0, healed: 0 })
    healRecentPartnerMarketplaceNotifications.mockResolvedValue({ scanned: 0, healed: 0, refreshed: 0 })

    await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ affiliateId: "aff_1" })
    await syncPartnerMarketplaceAlertsBeforeInboxIfDue({ affiliateId: "aff_1" }, { force: true })

    expect(reconcilePartnerPendingCheckoutOrders).toHaveBeenCalledTimes(2)
    expect(healRecentPartnerMarketplaceNotifications).toHaveBeenCalledTimes(2)
  })
})
