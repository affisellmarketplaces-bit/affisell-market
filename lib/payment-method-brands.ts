import {
  isMarketplaceBnplEnabled,
  isMarketplaceCheckoutWalletsEnabled,
  isMarketplacePaypalEnabled,
} from "@/lib/marketplace-checkout-payment-methods"

export type PaymentMethodBrandId =
  | "cb"
  | "visa"
  | "mastercard"
  | "amex"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "klarna"

const CARD_BRANDS: PaymentMethodBrandId[] = ["cb", "visa", "mastercard", "amex"]
const WALLET_BRANDS: PaymentMethodBrandId[] = ["apple_pay", "google_pay"]

/**
 * Brands shown in footer / trust surfaces — mirrors Stripe Checkout capabilities.
 * Oney is intentionally omitted (not enabled in Affisell Stripe Checkout).
 */
export function paymentMethodBrandsForDisplay(): PaymentMethodBrandId[] {
  const brands: PaymentMethodBrandId[] = [...CARD_BRANDS]

  if (isMarketplaceBnplEnabled()) {
    brands.push("klarna")
  }

  if (isMarketplacePaypalEnabled()) {
    brands.push("paypal")
  }

  if (isMarketplaceCheckoutWalletsEnabled()) {
    brands.push(...WALLET_BRANDS)
  }

  return brands
}

export function paymentMethodBrandLabel(id: PaymentMethodBrandId): string {
  const labels: Record<PaymentMethodBrandId, string> = {
    cb: "Carte Bancaire",
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    paypal: "PayPal",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    klarna: "Klarna",
  }
  return labels[id]
}
