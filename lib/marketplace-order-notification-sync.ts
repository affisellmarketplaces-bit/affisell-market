import { reconcilePartnerPendingCheckoutOrders } from "@/lib/cron/reconcile-partner-pending-checkouts"
import {
  healRecentPartnerMarketplaceNotifications,
  type HealPartnerNotificationsResult,
} from "@/lib/marketplace-order-notification-heal"

type PartnerScope = { supplierId: string } | { affiliateId: string }

export type SyncPartnerMarketplaceAlertsResult = {
  reconcile: Awaited<ReturnType<typeof reconcilePartnerPendingCheckoutOrders>>
  heal: HealPartnerNotificationsResult
}

/** Fulfill recent paid Stripe checkouts, then heal missing inbox rows — call before reading notifications. */
export async function syncPartnerMarketplaceAlertsBeforeInbox(
  scope: PartnerScope
): Promise<SyncPartnerMarketplaceAlertsResult> {
  const reconcile = await reconcilePartnerPendingCheckoutOrders(scope)
  const heal = await healRecentPartnerMarketplaceNotifications(scope)

  if (reconcile.healed > 0 || heal.healed > 0) {
    console.log("[marketplace-order-notification-sync]", {
      scope: "supplierId" in scope ? "supplier" : "affiliate",
      partnerId: "supplierId" in scope ? scope.supplierId : scope.affiliateId,
      reconcileHealed: reconcile.healed,
      inboxHealed: heal.healed,
    })
  }

  return { reconcile, heal }
}
