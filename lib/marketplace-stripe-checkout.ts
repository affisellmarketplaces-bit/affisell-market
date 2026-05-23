import type Stripe from "stripe"

/** Shared Stripe Checkout options: HT line items + Stripe Tax (seller responsible for VAT). */
export function marketplaceCheckoutTaxOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "automatic_tax" | "tax_id_collection"
> {
  return {
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
  }
}

export type MarketplaceStripeLineItem = {
  price_data: {
    currency: "eur"
    unit_amount: number
    tax_behavior: "exclusive"
    product_data: { name: string; images: string[] }
  }
  quantity: number
}

export function buildHtLineItem(args: {
  name: string
  images: string[]
  linePaidCentsHt: number
  qty: number
}): MarketplaceStripeLineItem {
  const qty = Math.max(1, Math.round(args.qty))
  const lineTotalHt = Math.max(0, Math.round(args.linePaidCentsHt))
  const unitAmount = Math.max(0, Math.round(lineTotalHt / qty))
  return {
    price_data: {
      currency: "eur",
      unit_amount: unitAmount,
      tax_behavior: "exclusive",
      product_data: { name: args.name, images: args.images },
    },
    quantity: qty,
  }
}
