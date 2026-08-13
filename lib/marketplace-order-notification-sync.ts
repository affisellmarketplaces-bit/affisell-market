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

/** Avoid Stripe reconcile + inbox heal on every notifications poll (was ~2s every 3s). */
export const PARTNER_MARKETPLACE_ALERT_SYNC_MIN_INTERVAL_MS = 60_000

const lastSyncAtByPartnerKey = new Map<string, number>()

function partnerSyncKey(scope: PartnerScope): string {
  return "supplierId" in scope ? `supplier:${scope.supplierId}` : `affiliate:${scope.affiliateId}`
}

/** @internal test helper */
export function resetPartnerMarketplaceAlertSyncThrottleForTests(): void {
  lastSyncAtByPartnerKey.clear()
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

  lastSyncAtByPartnerKey.set(partnerSyncKey(scope), Date.now())
  return { reconcile, heal }
}

/** Throttled inbox sync for notification polling — skips heavy work if synced recently. */
export async function syncPartnerMarketplaceAlertsBeforeInboxIfDue(
  scope: PartnerScope,
  options?: { force?: boolean }
): Promise<SyncPartnerMarketplaceAlertsResult | null> {
  const key = partnerSyncKey(scope)
  const now = Date.now()
  const last = lastSyncAtByPartnerKey.get(key) ?? 0
  if (!options?.force && now - last < PARTNER_MARKETPLACE_ALERT_SYNC_MIN_INTERVAL_MS) {
    return null
  }
  return syncPartnerMarketplaceAlertsBeforeInbox(scope)
}
