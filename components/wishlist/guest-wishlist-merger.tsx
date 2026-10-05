"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"

import { notifyBuyerPersonalizationRefresh } from "@/lib/buyer-personalization-refresh.client"
import { mergeGuestWishlistOncePerSession } from "@/lib/guest-wishlist-merge-once.client"

/**
 * Renders nothing. When a visitor who saved favourites as a guest signs in (or signs up), their favourites — with the
 * price alert they asked for — move into their account. Without this the account starts empty and the alert is lost.
 */
export function GuestWishlistMerger() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (status !== "authenticated" || !userId) return
    void mergeGuestWishlistOncePerSession(userId).then((result) => {
      if (result && result.merged > 0) notifyBuyerPersonalizationRefresh("wishlist_updated")
    })
  }, [status, userId])

  return null
}
