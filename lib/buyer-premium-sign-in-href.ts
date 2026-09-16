import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"

/** Shared (server + client) — do not put in a `"use client"` module. */
export function resolveBuyerPremiumSignInHref(isBuyerContext: boolean): string {
  return isBuyerContext ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH) : "/login"
}
