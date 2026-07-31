import type Stripe from "stripe"

import { isAffisellVatFranchise } from "@/lib/legal/company-env"

/**
 * Stripe Tax on marketplace Checkout.
 * Default OFF under art. 293 B (no COMPANY_VAT / AFFISELL_TVA).
 * Set STRIPE_AUTOMATIC_TAX=1 after exiting franchise / VAT registration.
 */
export function isStripeAutomaticTaxEnabled(): boolean {
  const override = process.env.STRIPE_AUTOMATIC_TAX?.trim().toLowerCase()
  if (override === "1" || override === "true" || override === "on" || override === "yes") {
    return true
  }
  if (override === "0" || override === "false" || override === "off" || override === "no") {
    return false
  }
  return !isAffisellVatFranchise()
}

/** Shared Stripe Checkout options aligned with Affisell VAT regime. */
export function marketplaceCheckoutTaxOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "automatic_tax" | "tax_id_collection"
> {
  const enabled = isStripeAutomaticTaxEnabled()
  console.log("[marketplace-stripe-checkout]", {
    result: enabled ? "automatic_tax_on" : "automatic_tax_off_293b",
  })
  if (!enabled) {
    return {
      automatic_tax: { enabled: false },
    }
  }
  return {
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
  }
}

export type MarketplaceStripeLineItem = {
  price_data: {
    currency: "eur"
    unit_amount: number
    tax_behavior?: "exclusive" | "inclusive"
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
  const taxOn = isStripeAutomaticTaxEnabled()
  return {
    price_data: {
      currency: "eur",
      unit_amount: unitAmount,
      // Exclusive only when Stripe Tax may add VAT on top; franchise = listed price is charged as-is.
      ...(taxOn ? { tax_behavior: "exclusive" as const } : {}),
      product_data: { name: args.name, images: args.images },
    },
    quantity: qty,
  }
}
