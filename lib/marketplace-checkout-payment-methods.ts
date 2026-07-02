/** Klarna pay-in-3 typical EU minimum (Stripe may enforce per country). */
export const KLARNA_ELIGIBLE_MIN_CENTS = 35_00

export const MARKETPLACE_BNPL_INSTALLMENTS = 3

export type MarketplaceCheckoutPaymentMethodType = "card" | "klarna" | "paypal"

const BNPL_TYPES: readonly MarketplaceCheckoutPaymentMethodType[] = ["klarna"]

export function isMarketplaceBnplEnabled(): boolean {
  return process.env.MARKETPLACE_BNPL_ENABLED !== "0"
}

/** PayPal in Stripe Checkout — opt-in via Dashboard + `MARKETPLACE_PAYPAL_ENABLED=1`. */
export function isMarketplacePaypalEnabled(): boolean {
  return process.env.MARKETPLACE_PAYPAL_ENABLED === "1"
}

/**
 * Apple Pay / Google Pay badges (card wallet rails in Stripe Checkout).
 * Disable with `MARKETPLACE_CHECKOUT_WALLETS_ENABLED=0`.
 */
export function isMarketplaceCheckoutWalletsEnabled(): boolean {
  return process.env.MARKETPLACE_CHECKOUT_WALLETS_ENABLED !== "0"
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

/** Single source of truth — Stripe Checkout `payment_method_types` + footer badges. */
export function marketplaceEnabledCheckoutPaymentMethodTypes(): MarketplaceCheckoutPaymentMethodType[] {
  const types: MarketplaceCheckoutPaymentMethodType[] = ["card"]
  if (isMarketplaceBnplEnabled()) {
    types.push(...BNPL_TYPES)
  }
  if (isMarketplacePaypalEnabled()) {
    types.push("paypal")
  }
  return types
}

/**
 * Checkout session methods for a cart total — Klarna only when amount meets EU minimum.
 * PayPal stays available whenever `MARKETPLACE_PAYPAL_ENABLED=1` (Stripe Dashboard must enable PayPal).
 */
export function marketplaceEnabledCheckoutPaymentMethodTypesForAmount(
  amountCents: number
): MarketplaceCheckoutPaymentMethodType[] {
  const types: MarketplaceCheckoutPaymentMethodType[] = ["card"]
  if (isMarketplaceBnplEnabled() && isKlarnaEligibleCents(amountCents)) {
    types.push(...BNPL_TYPES)
  }
  if (isMarketplacePaypalEnabled()) {
    types.push("paypal")
  }
  return types
}

/** Stripe Checkout session payment methods for marketplace buyer flows. */
export function marketplaceCheckoutPaymentSessionOptions(): {
  payment_method_types: MarketplaceCheckoutPaymentMethodType[]
} {
  return {
    payment_method_types: marketplaceEnabledCheckoutPaymentMethodTypes(),
  }
}

/** Amount-aware checkout options — prefer at session create time. */
export function marketplaceCheckoutPaymentSessionOptionsForAmount(amountCents: number): {
  payment_method_types: MarketplaceCheckoutPaymentMethodType[]
} {
  return {
    payment_method_types: marketplaceEnabledCheckoutPaymentMethodTypesForAmount(amountCents),
  }
}
