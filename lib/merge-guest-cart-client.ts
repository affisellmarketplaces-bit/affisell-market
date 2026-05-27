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
