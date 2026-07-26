"use client"

import { addToBuyerCart, type AddToBuyerCartInput } from "@/lib/cart-add-client"
import { clientNavigateOrAssign } from "@/lib/client-navigate.client"
import {
  fastCheckoutRedirected,
  startFastCheckout,
  type FastCheckoutBody,
} from "@/lib/fast-checkout-client"

export type BuyNowWithoutLoginMeta = Pick<
  AddToBuyerCartInput,
  "title" | "price" | "imageUrl" | "sellerName" | "selectedColor" | "selectedSize"
> & { productId: string }

export type BuyNowOutOfStockPayload = {
  productName?: string
  alternatives?: Array<{
    affiliateProductId: string
    title: string
    image: string | null
    priceCents: number
    href: string
  }>
  coupon?: string
}

export type BuyNowOutcome =
  | "stripe"
  | "cart"
  | "error"
  | { kind: "out_of_stock"; payload: BuyNowOutOfStockPayload }

/**
 * Stripe checkout once the buyer is identified (CUSTOMER session).
 * Guests: use `useBuyNowWithIdentity` to collect email/phone + cashback account first.
 */
export async function buyNowWithoutLogin(
  body: FastCheckoutBody,
  productMeta: BuyNowWithoutLoginMeta
): Promise<BuyNowOutcome> {
  const listingId = body.productId?.trim() || body.affiliateProductId?.trim() || productMeta.productId

  async function fallbackToCart(): Promise<"cart" | "error"> {
    const add = await addToBuyerCart({
      ...productMeta,
      productId: listingId,
      qty: body.qty ?? 1,
    })
    if (add.ok) {
      clientNavigateOrAssign("/cart?checkout=1")
      return "cart"
    }
    return "error"
  }

  const result = await startFastCheckout(body)
  if (fastCheckoutRedirected(result)) return "stripe"

  if (!result.ok && result.status === "out_of_stock") {
    return {
      kind: "out_of_stock",
      payload: {
        productName: result.productName,
        alternatives: result.alternatives,
        coupon: result.coupon,
      },
    }
  }

  const cart = await fallbackToCart()
  if (cart === "cart") return "cart"

  console.error("[guest-buy-now]", {
    listingId,
    result: "failed",
    checkoutError: result.ok ? null : result.message,
  })
  return "error"
}
