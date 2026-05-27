"use client"

import { addToBuyerCart, type AddToBuyerCartInput } from "@/lib/cart-add-client"
import {
  fastCheckoutRedirected,
  startFastCheckout,
  type FastCheckoutBody,
} from "@/lib/fast-checkout-client"

type ProductMeta = Pick<
  AddToBuyerCartInput,
  "title" | "price" | "imageUrl" | "sellerName" | "selectedColor" | "selectedSize"
>

/**
 * Stripe checkout without prior login. On failure, adds to guest cart and opens checkout identity on `/cart`.
 */
export async function buyNowWithoutLogin(
  body: FastCheckoutBody,
  productMeta: ProductMeta & { productId: string }
): Promise<"stripe" | "cart" | "error"> {
  const result = await startFastCheckout(body)
  if (fastCheckoutRedirected(result)) return "stripe"

  const listingId = body.productId?.trim() || body.affiliateProductId?.trim() || productMeta.productId
  const add = await addToBuyerCart({
    ...productMeta,
    productId: listingId,
    qty: body.qty ?? 1,
  })
  if (add.ok) {
    window.location.assign("/cart?checkout=1")
    return "cart"
  }
  return "error"
}
