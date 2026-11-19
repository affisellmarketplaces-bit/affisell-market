/**
 * What the shopper is shown when the checkout is refused because of OUR stock counter (`OUT_OF_STOCK`, `INSUFFICIENT_STOCK`
 * from `lib/marketplace-checkout.ts`). Pure and client-safe (no prisma, no I/O): the server sends a CODE and quantities, the
 * front end turns them into a sentence with the existing i18n mechanism — a raw machine code is never shown, and the
 * supplier-probe modal ("we just checked with our supplier", a coupon) is NOT used: that is `OUT_OF_STOCK_VERIFIED`'s copy.
 */

export type CheckoutStockRefusalCode = "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "PRICE_BELOW_SUPPLIER_PRICE" | "VARIANT_UNAVAILABLE"

export type CheckoutStockRefusal = {
  code: CheckoutStockRefusalCode
  /** How many the shopper could still buy of that product (`null` when the server did not say). */
  availableQty: number | null
  /** VARIANT_UNAVAILABLE only: the options the shopper can still choose (the product's own variant names). */
  availableVariants?: string[]
}

/** Reads a 409 payload of `/api/checkout`; `null` when it is not one of our stock refusals. */
export function parseCheckoutStockRefusal(data: unknown): CheckoutStockRefusal | null {
  if (!data || typeof data !== "object") return null
  const d = data as { error?: unknown; availableQty?: unknown }
  // PRICE_BELOW_SUPPLIER_PRICE (lib/checkout-price-guard.ts) travels the same way: a refusal before any payment.
  if (
    d.error !== "OUT_OF_STOCK" &&
    d.error !== "INSUFFICIENT_STOCK" &&
    d.error !== "PRICE_BELOW_SUPPLIER_PRICE" &&
    d.error !== "VARIANT_UNAVAILABLE"
  ) {
    return null
  }
  const q = typeof d.availableQty === "number" && Number.isFinite(d.availableQty) ? Math.max(0, Math.round(d.availableQty)) : null
  if (d.error === "VARIANT_UNAVAILABLE") {
    const raw = (data as { availableVariants?: unknown }).availableVariants
    const availableVariants = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 6) : []
    return { code: d.error, availableQty: null, availableVariants }
  }
  return { code: d.error, availableQty: q }
}

/** The translated sentence, with the `checkoutStock` messages namespace (`outOfStock`, `insufficient` with `{count}`). */
export function checkoutStockMessage(
  refusal: CheckoutStockRefusal,
  t: (key: "outOfStock" | "insufficient" | "priceUpdating" | "variantUnavailable" | "variantUnavailableWith", values?: { count?: number; options?: string }) => string
): string {
  if (refusal.code === "PRICE_BELOW_SUPPLIER_PRICE") return t("priceUpdating")
  if (refusal.code === "VARIANT_UNAVAILABLE") {
    // Never a replacement chosen for the shopper: the options still on sale are named, the shopper picks.
    const options = refusal.availableVariants ?? []
    return options.length > 0 ? t("variantUnavailableWith", { options: options.join(", ") }) : t("variantUnavailable")
  }
  if (refusal.code === "INSUFFICIENT_STOCK" && refusal.availableQty != null && refusal.availableQty > 0) {
    return t("insufficient", { count: refusal.availableQty })
  }
  return t("outOfStock")
}
