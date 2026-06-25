/** Stripe Checkout minimum card charge (EUR cents) — https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts */
export const STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS = 50 // €0.50

export function isStripeCheckoutPaidTotalValid(totalCents: number): boolean {
  return totalCents >= STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS
}

export function sumPaidLinesCents(paidLineCents: number[]): number {
  return paidLineCents.reduce((sum, cents) => sum + Math.max(0, Math.round(cents)), 0)
}
