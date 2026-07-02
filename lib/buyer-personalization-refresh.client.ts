"use client"

export const BUYER_PERSONALIZATION_REFRESH_EVENT = "affisell:buyer-personalization-refresh"

export const BUYER_PERSONALIZATION_REFRESH_PENDING_KEY =
  "affisell:buyer-personalization-refresh-pending"

export type BuyerPersonalizationRefreshReason = "checkout_success" | "wishlist_updated" | "browse_updated"

function isRefreshReason(raw: string | null): raw is BuyerPersonalizationRefreshReason {
  return raw === "checkout_success" || raw === "wishlist_updated" || raw === "browse_updated"
}

/** Survives Stripe redirect to `/success` until the next rail mount. */
export function markBuyerPersonalizationRefreshPending(
  reason: BuyerPersonalizationRefreshReason
): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY, reason)
  } catch {
    /* private mode / quota */
  }
}

export function consumeBuyerPersonalizationRefreshPending(): BuyerPersonalizationRefreshReason | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY)
    sessionStorage.removeItem(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY)
    return isRefreshReason(raw) ? raw : null
  } catch {
    return null
  }
}

export function readBuyerPersonalizationRefreshPending(): BuyerPersonalizationRefreshReason | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(BUYER_PERSONALIZATION_REFRESH_PENDING_KEY)
    return isRefreshReason(raw) ? raw : null
  } catch {
    return null
  }
}

/** Cross-surface refresh event for recommendation rails after buyer signals change. */
export function notifyBuyerPersonalizationRefresh(
  reason: BuyerPersonalizationRefreshReason
): void {
  if (typeof window === "undefined") return
  markBuyerPersonalizationRefreshPending(reason)
  window.dispatchEvent(
    new CustomEvent<BuyerPersonalizationRefreshReason>(BUYER_PERSONALIZATION_REFRESH_EVENT, {
      detail: reason,
    })
  )
}
