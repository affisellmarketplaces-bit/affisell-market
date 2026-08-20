/** Base Stripe Checkout session id without per-line `:line:N` suffix. */
export function resolveBaseStripeSessionId(stripeSessionId: string): string {
  const idx = stripeSessionId.indexOf(":line:")
  return idx >= 0 ? stripeSessionId.slice(0, idx) : stripeSessionId
}

/** Prisma filter for all order rows belonging to one checkout session. */
export function stripeSessionOrderWhere(baseSessionId: string): {
  OR: Array<
    | { stripeSessionId: string }
    | { stripeSessionId: { startsWith: string } }
  >
} {
  return {
    OR: [
      { stripeSessionId: baseSessionId },
      { stripeSessionId: { startsWith: `${baseSessionId}:line:` } },
    ],
  }
}
