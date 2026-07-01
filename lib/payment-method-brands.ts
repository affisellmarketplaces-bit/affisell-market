import { isMarketplaceBnplEnabled } from "@/lib/marketplace-checkout-payment-methods"

export type PaymentMethodBrandId =
  | "cb"
  | "visa"
  | "mastercard"
  | "amex"
  | "oney"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "klarna"

const CARD_BRANDS: PaymentMethodBrandId[] = ["cb", "visa", "mastercard", "amex"]
const WALLET_BRANDS: PaymentMethodBrandId[] = ["paypal", "apple_pay", "google_pay"]
const BNPL_BRANDS: PaymentMethodBrandId[] = ["oney", "klarna"]

const ALL_DISPLAY_BRANDS: PaymentMethodBrandId[] = [
  ...CARD_BRANDS,
  ...BNPL_BRANDS,
  ...WALLET_BRANDS,
]

/** Brands shown in footer / trust surfaces (Stripe-powered checkout). */
export function paymentMethodBrandsForDisplay(): PaymentMethodBrandId[] {
  if (!isMarketplaceBnplEnabled()) {
    return [...CARD_BRANDS, ...WALLET_BRANDS]
  }
  return [...ALL_DISPLAY_BRANDS]
}

export function paymentMethodBrandLabel(id: PaymentMethodBrandId): string {
  const labels: Record<PaymentMethodBrandId, string> = {
    cb: "Carte Bancaire",
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    oney: "Oney",
    paypal: "PayPal",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    klarna: "Klarna",
  }
  return labels[id]
}
