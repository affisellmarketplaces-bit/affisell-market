"use client"

export const BUYER_PERSONALIZATION_REFRESH_EVENT = "affisell:buyer-personalization-refresh"

export type BuyerPersonalizationRefreshReason = "checkout_success" | "wishlist_updated" | "browse_updated"

/** Cross-surface refresh event for recommendation rails after buyer signals change. */
export function notifyBuyerPersonalizationRefresh(
  reason: BuyerPersonalizationRefreshReason
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<BuyerPersonalizationRefreshReason>(BUYER_PERSONALIZATION_REFRESH_EVENT, {
      detail: reason,
    })
  )
}
