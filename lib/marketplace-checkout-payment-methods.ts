import type Stripe from "stripe"

/** Klarna pay-in-3 typical EU minimum (Stripe may enforce per country). */
export const KLARNA_ELIGIBLE_MIN_CENTS = 35_00

export const MARKETPLACE_BNPL_INSTALLMENTS = 3

const MARKETPLACE_CHECKOUT_PAYMENT_METHOD_TYPES = ["card", "klarna"] as const satisfies readonly Stripe.Checkout.SessionCreateParams.PaymentMethodType[]

export function isMarketplaceBnplEnabled(): boolean {
  return process.env.MARKETPLACE_BNPL_ENABLED !== "0"
}

export function isKlarnaEligibleCents(amountCents: number): boolean {
  if (!isMarketplaceBnplEnabled()) return false
  return Math.round(amountCents) >= KLARNA_ELIGIBLE_MIN_CENTS
}

export function klarnaInstallmentCents(
  amountCents: number,
  installments: number = MARKETPLACE_BNPL_INSTALLMENTS
): number {
  const n = Math.max(1, Math.round(installments))
  return Math.max(0, Math.ceil(Math.round(amountCents) / n))
}

/** Stripe Checkout session payment methods for marketplace buyer flows. */
export function marketplaceCheckoutPaymentSessionOptions(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "payment_method_types"
> {
  if (!isMarketplaceBnplEnabled()) {
    return { payment_method_types: ["card"] }
  }
  return {
    payment_method_types: [...MARKETPLACE_CHECKOUT_PAYMENT_METHOD_TYPES],
  }
}
