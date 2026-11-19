"use client"

import { hasVariantChoice, listingRequiresVariantChoice, variantChoicePageHref } from "@/lib/variant-choice-client"
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
  /** Capacity, only for a product with a size AND a storage dimension (guest carts do not keep it yet). */
  selectedStorage?: string | null
  /** The product page to send the shopper to when a choice is needed (default: the marketplace page). */
  detailHref?: string | null
  /** The caller (a product page) already checked the choice with the shared rule: no extra request. */
  variantChoiceChecked?: boolean
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

  // A card adds with no size / colour: a product that needs one is chosen on its page, never added undetermined.
  if (!input.variantChoiceChecked && !hasVariantChoice(input) && (await listingRequiresVariantChoice(productId))) {
    if (typeof window !== "undefined") window.location.assign(variantChoicePageHref(productId, input.detailHref))
    return { ok: false, error: "variant_choice_required" }
  }

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
      selectedStorage: input.selectedStorage ?? undefined,
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
