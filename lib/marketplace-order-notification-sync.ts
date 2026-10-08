/**
 * EXPLICIT business catch-up for marketplace order alerts — NOT part of reading the inbox.
 *
 * What it does is NOT read-only: it retrieves Stripe checkout sessions, may fulfil paid orders and schedule transfers
 * (`reconcilePartnerPendingCheckoutOrders`), and heals inbox rows / `Order` amounts inside transactions
 * (`healRecentPartnerMarketplaceNotifications`). On a cold serverless instance this takes far longer than the 10 s API
 * budget (production, 2026-10: 96 % of cold supplier polls timed out). Therefore:
 *   - NO GET handler (supplier/affiliate notifications, supplier orders) may call anything from this module —
 *     enforced by `lib/__tests__/notifications-get-read-only.test.ts`;
 *   - callers are explicit, bounded, asynchronous mechanisms (post-payment follow-ups, a dedicated job) decided
 *     separately from the read path.
 * The per-instance throttle below is therefore not a protection for any GET; it only de-duplicates explicit callers.
 */
import type { ReconcilePartnerPendingResult } from "@/lib/cron/reconcile-partner-pending-checkouts"
import {
  healRecentPartnerMarketplaceNotifications,
  type HealPartnerNotificationsResult,
} from "@/lib/marketplace-order-notification-heal"

type PartnerScope = { supplierId: string } | { affiliateId: string }

export type SyncPartnerMarketplaceAlertsResult = {
  reconcile: ReconcilePartnerPendingResult
  heal: HealPartnerNotificationsResult
}

export type SyncPartnerMarketplaceAlertsOptions = {
  /** Also re-render the inbox copy of the most recent already-notified orders. Off unless explicitly asked. */
  includeRefresh?: boolean
}

/** Lazy — avoids bundling stripe fulfill + auto-buy + playwright on notification polls. */
async function reconcilePartnerPendingCheckoutOrders(
  scope: PartnerScope
): Promise<ReconcilePartnerPendingResult> {
  const { reconcilePartnerPendingCheckoutOrders: reconcile } = await import(
    "@/lib/cron/reconcile-partner-pending-checkouts"
  )
  return reconcile(scope)
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

/**
 * Fulfill recent paid Stripe checkouts, then heal missing inbox rows. EXPLICIT catch-up: never call it from a GET
 * handler or await it before reading the inbox (see the header of this module).
 */
export async function syncPartnerMarketplaceAlertsBeforeInbox(
  scope: PartnerScope,
  options: SyncPartnerMarketplaceAlertsOptions = {}
): Promise<SyncPartnerMarketplaceAlertsResult> {
  const reconcile = await reconcilePartnerPendingCheckoutOrders(scope)
  const heal = await healRecentPartnerMarketplaceNotifications(scope, {
    includeRefresh: options.includeRefresh === true,
  })

  if (reconcile.healed > 0 || heal.healed > 0 || heal.refreshed > 0) {
    console.log("[marketplace-order-notification-sync]", {
      scope: "supplierId" in scope ? "supplier" : "affiliate",
      partnerId: "supplierId" in scope ? scope.supplierId : scope.affiliateId,
      reconcileHealed: reconcile.healed,
      inboxHealed: heal.healed,
      inboxRefreshed: heal.refreshed,
    })
  }

  lastSyncAtByPartnerKey.set(partnerSyncKey(scope), Date.now())
  return { reconcile, heal }
}

/**
 * De-duplicated EXPLICIT catch-up — skips the heavy work if this instance synced the partner recently.
 * Per-instance memory only (a cold instance starts empty), so it is NOT a guard for a request path.
 */
export async function syncPartnerMarketplaceAlertsBeforeInboxIfDue(
  scope: PartnerScope,
  options?: { force?: boolean } & SyncPartnerMarketplaceAlertsOptions
): Promise<SyncPartnerMarketplaceAlertsResult | null> {
  const key = partnerSyncKey(scope)
  const now = Date.now()
  const last = lastSyncAtByPartnerKey.get(key) ?? 0
  if (!options?.force && now - last < PARTNER_MARKETPLACE_ALERT_SYNC_MIN_INTERVAL_MS) {
    return null
  }
  return syncPartnerMarketplaceAlertsBeforeInbox(scope, { includeRefresh: options?.includeRefresh })
}
