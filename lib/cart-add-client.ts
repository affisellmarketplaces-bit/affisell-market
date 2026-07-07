"use client"

import { buyerHaptic } from "@/lib/buyer-haptics"
import { addGuestCartItem, type CartAddedEventDetail, type GuestCartItem } from "@/lib/guest-cart"
import { dispatchCartUpdated } from "@/lib/buyer-cart-count-client"

export type AddToBuyerCartInput = {
  productId: string
  qty?: number
  title?: string
  price?: number
  imageUrl?: string
  sellerName?: string
  selectedColor?: string | null
  selectedSize?: string | null
}

export type AddToBuyerCartResult =
  | { ok: true; mode: "server" | "guest" }
  | { ok: false; error: string }

function notifyCartUpdated() {
  dispatchCartUpdated()
}

function notifyCartAdded(detail: CartAddedEventDetail) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<CartAddedEventDetail>("affisell:cart-added", { detail }))
}

/** Add to cart without login — server cart when signed in, local guest cart otherwise. */
export async function addToBuyerCart(input: AddToBuyerCartInput): Promise<AddToBuyerCartResult> {
  const productId = input.productId.trim()
  if (!productId) return { ok: false, error: "Missing product" }

  const qty = Math.max(1, Math.min(99, Math.round(Number(input.qty)) || 1))
  const variantSignature = [input.selectedColor, input.selectedSize].filter(Boolean).join("|")

  const res = await fetch("/api/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      qty,
      quantity: qty,
      selectedColor: input.selectedColor ?? undefined,
      selectedSize: input.selectedSize ?? undefined,
    }),
    credentials: "include",
  })

  if (res.ok) {
    notifyCartUpdated()
    notifyCartAdded({
      productId,
      productName: input.title?.trim() || "Product",
      qtyAdded: qty,
      variantSignature,
    })
    buyerHaptic("cartAdd")
    console.log("[cart-add-client]", { productId, result: "server" })
    return { ok: true, mode: "server" }
  }

  if (res.status === 401) {
    const guestItem: GuestCartItem = {
      productId,
      qty,
      title: input.title,
      price: input.price,
      imageUrl: input.imageUrl,
      sellerName: input.sellerName,
      selectedColor: input.selectedColor ?? undefined,
      selectedSize: input.selectedSize ?? undefined,
    }
    addGuestCartItem(guestItem)
    notifyCartUpdated()
    notifyCartAdded({
      productId,
      productName: input.title?.trim() || "Product",
      qtyAdded: qty,
      variantSignature,
    })
    buyerHaptic("cartAdd")
    console.log("[cart-add-client]", { productId, result: "guest" })
    return { ok: true, mode: "guest" }
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, error: data.error ?? "Could not add to cart" }
}
