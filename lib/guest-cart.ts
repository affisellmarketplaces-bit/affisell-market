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
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const item = row as Partial<GuestCartItem>
        const productId = typeof item.productId === "string" ? item.productId.trim() : ""
        if (!productId) return null
        return {
          productId,
          qty: sanitizeQty(Number(item.qty)),
          title: typeof item.title === "string" ? item.title : undefined,
          price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
          imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
          sellerName: typeof item.sellerName === "string" ? item.sellerName : undefined,
        }
      })
      .filter((row): row is GuestCartItem => Boolean(row))
  } catch {
    return []
  }
}

export function writeGuestCart(items: GuestCartItem[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
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
