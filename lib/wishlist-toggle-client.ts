"use client"

import {
  notifyBuyerWishlistUpdated,
} from "@/lib/buyer-wishlist-signals.client"

export type WishlistToggleResult =
  | { ok: true; wished: boolean; likeCount: number }
  | { ok: false; error: string }

/** Like / unlike a product — works for guests (cookie) and signed-in buyers. */
export async function toggleProductWishlist(
  productId: string,
  options?: { targetPriceEur?: number }
): Promise<WishlistToggleResult> {
  const id = productId.trim()
  if (!id) return { ok: false, error: "Missing product" }

  const body: { productId: string; targetPrice?: number } = { productId: id }
  if (
    typeof options?.targetPriceEur === "number" &&
    Number.isFinite(options.targetPriceEur) &&
    options.targetPriceEur > 0
  ) {
    body.targetPrice = options.targetPriceEur
  }

  const res = await fetch("/api/wishlist/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })

  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    wished?: boolean
    likeCount?: number
  }

  if (!res.ok) {
    return { ok: false, error: data.error ?? "Could not update wishlist" }
  }

  const wished = Boolean(data.wished)
  notifyBuyerWishlistUpdated({ productId: id, wished })

  return {
    ok: true,
    wished,
    likeCount: Math.max(0, Number(data.likeCount ?? 0)),
  }
}
