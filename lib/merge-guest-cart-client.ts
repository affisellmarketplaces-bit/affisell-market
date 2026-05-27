"use client"

import { readGuestCart, writeGuestCart } from "@/lib/guest-cart"

/** After buyer identify sign-in, persist guest lines to the server cart. */
export async function mergeGuestCartToServer(): Promise<{ merged: number }> {
  const items = readGuestCart()
  if (items.length === 0) return { merged: 0 }

  const res = await fetch("/api/cart/merge-guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    merged?: number
    error?: string
  }

  if (!res.ok) {
    console.error("[merge-guest-cart-client]", { status: res.status, error: data.error })
    return { merged: 0 }
  }

  writeGuestCart([])
  window.dispatchEvent(new CustomEvent("affisell:cart-updated"))
  const merged = typeof data.merged === "number" ? data.merged : items.length
  console.log("[merge-guest-cart-client]", { merged, result: "ok" })
  return { merged }
}

/** Merge guest likes (cookie) into authenticated wishlist after sign-in. */
export async function mergeGuestWishlistToServer(): Promise<{ merged: number }> {
  const res = await fetch("/api/wishlist/merge-guest", {
    method: "POST",
    credentials: "include",
  })
  const data = (await res.json().catch(() => ({}))) as { merged?: number; error?: string }
  if (!res.ok) {
    console.error("[merge-guest-wishlist-client]", { status: res.status, error: data.error })
    return { merged: 0 }
  }
  const merged = Number(data.merged ?? 0)
  console.log("[merge-guest-wishlist-client]", { merged, result: "ok" })
  return { merged }
}

/** Cart + wishlist merge after buyer login. */
export async function mergeGuestBuyerSessionToServer(): Promise<{
  cartMerged: number
  wishlistMerged: number
}> {
  const [cart, wishlist] = await Promise.all([
    mergeGuestCartToServer(),
    mergeGuestWishlistToServer(),
  ])
  return { cartMerged: cart.merged, wishlistMerged: wishlist.merged }
}
