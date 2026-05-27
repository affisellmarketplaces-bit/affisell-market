"use client"

export type WishlistToggleResult =
  | { ok: true; wished: boolean; likeCount: number }
  | { ok: false; error: string }

/** Like / unlike a product — works for guests (cookie) and signed-in buyers. */
export async function toggleProductWishlist(productId: string): Promise<WishlistToggleResult> {
  const id = productId.trim()
  if (!id) return { ok: false, error: "Missing product" }

  const res = await fetch("/api/wishlist/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: id }),
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

  return {
    ok: true,
    wished: Boolean(data.wished),
    likeCount: Math.max(0, Number(data.likeCount ?? 0)),
  }
}
