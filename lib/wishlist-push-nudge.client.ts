"use client"

import { requestPriceAlertPushSubscription } from "@/components/push/request-price-alert-push"
import { fetchBuyerSessionSnapshot } from "@/lib/buyer-session-client"

export const PENDING_PRICE_PUSH_AFTER_LOGIN_KEY = "affisell:pending-price-push"

/** Guest save-drop: replay push opt-in after buyer signs in. */
export function markPendingPricePushAfterLogin(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(PENDING_PRICE_PUSH_AFTER_LOGIN_KEY, "1")
  } catch {
    /* private mode */
  }
}

export function readPendingPricePushAfterLogin(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(PENDING_PRICE_PUSH_AFTER_LOGIN_KEY) === "1"
  } catch {
    return false
  }
}

function clearPendingPricePushAfterLogin(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(PENDING_PRICE_PUSH_AFTER_LOGIN_KEY)
  } catch {
    /* private mode */
  }
}

/** Idempotent — call on Pulse / discover mount after login redirect. */
export async function consumePendingPricePushAfterLogin(): Promise<"granted" | "skipped"> {
  if (!readPendingPricePushAfterLogin()) return "skipped"

  const session = await fetchBuyerSessionSnapshot()
  if (!session.userId) return "skipped"

  clearPendingPricePushAfterLogin()
  const result = await requestPriceAlertPushSubscription()
  return result === "granted" ? "granted" : "skipped"
}
