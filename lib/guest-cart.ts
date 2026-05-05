"use client"

export const GUEST_CART_KEY = "affisell_cart"

export type GuestCartItem = {
  productId: string
  qty: number
  title?: string
  price?: number
  imageUrl?: string
  sellerName?: string
}

export type CartAddedEventDetail = {
  productId: string
  productName: string
  qtyAdded: number
}

function sanitizeQty(input: number) {
  return Math.max(1, Math.min(99, Math.round(Number(input)) || 1))
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row): GuestCartItem[] => {
      if (!row || typeof row !== "object") return []
      const item = row as Partial<GuestCartItem>
      const productId = typeof item.productId === "string" ? item.productId.trim() : ""
      if (!productId) return []
      return [
        {
          productId,
          qty: sanitizeQty(Number(item.qty)),
          title: typeof item.title === "string" ? item.title : undefined,
          price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
          imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
          sellerName: typeof item.sellerName === "string" ? item.sellerName : undefined,
        },
      ]
    })
  } catch {
    return []
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent("affisell:cart-updated"))
}

export function guestCartCount() {
  return readGuestCart().reduce((sum, item) => sum + sanitizeQty(item.qty), 0)
}

export function addGuestCartItem(input: GuestCartItem) {
  const cart = readGuestCart()
  const idx = cart.findIndex((item) => item.productId === input.productId)
  if (idx >= 0) {
    cart[idx] = {
      ...cart[idx],
      ...input,
      qty: sanitizeQty(cart[idx].qty + input.qty),
    }
  } else {
    cart.push({
      ...input,
      qty: sanitizeQty(input.qty),
    })
  }
  writeGuestCart(cart)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<CartAddedEventDetail>("affisell:cart-added", {
        detail: {
          productId: input.productId,
          productName: input.title || "Product",
          qtyAdded: sanitizeQty(input.qty),
        },
      })
    )
  }
  return cart
}

export function setGuestCartQuantity(productId: string, qty: number) {
  const cart = readGuestCart()
  const nextQty = sanitizeQty(qty)
  const next = cart.map((item) => (item.productId === productId ? { ...item, qty: nextQty } : item))
  writeGuestCart(next)
  return next
}

export function removeGuestCartItem(productId: string) {
  const next = readGuestCart().filter((item) => item.productId !== productId)
  writeGuestCart(next)
  return next
}
