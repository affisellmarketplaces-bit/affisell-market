import { normalizeCartVariantSignature } from "@/lib/cart-variant"

import type { GuestCartItem } from "@/lib/guest-cart"

export function guestCartLineId(item: Pick<GuestCartItem, "productId" | "selectedColor" | "selectedSize" | "selectedStorage">): string {
  // Same signature as `guestItemVariantSignature` (kept inline: this module must not import the client cart store).
  const sig = normalizeCartVariantSignature(item.selectedColor, item.selectedSize, item.selectedSize ? item.selectedStorage : null)
  const pid = item.productId
  if (!sig) return `guest-${pid}`
  return `guest-${pid}@@${encodeURIComponent(sig)}`
}

export function parseGuestCartLineId(id: string): { productId: string; variantSignature: string } | null {
  if (!id.startsWith("guest-")) return null
  const rest = id.slice("guest-".length)
  const sep = "@@"
  const i = rest.indexOf(sep)
  if (i < 0) return { productId: rest, variantSignature: "" }
  const productId = rest.slice(0, i)
  let variantSignature = ""
  try {
    variantSignature = decodeURIComponent(rest.slice(i + sep.length))
  } catch {
    variantSignature = ""
  }
  return { productId, variantSignature }
}
