"use client"

import { notifyBuyerPersonalizationRefresh } from "@/lib/buyer-personalization-refresh.client"

export const BUYER_WISHLIST_UPDATED_EVENT = "affisell:wishlist-updated"

export type BuyerWishlistUpdatedDetail = {
  productId: string
  wished: boolean
}

/** Fired after a successful wishlist toggle — refreshes personalized picks rails. */
export function notifyBuyerWishlistUpdated(detail: BuyerWishlistUpdatedDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<BuyerWishlistUpdatedDetail>(BUYER_WISHLIST_UPDATED_EVENT, { detail }))
  notifyBuyerPersonalizationRefresh("wishlist_updated")
}
