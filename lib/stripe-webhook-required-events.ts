/**
 * Every Stripe event type `lib/stripe-webhook-processor.ts` acts on — the subscription the platform webhook endpoint
 * MUST have in the Stripe Dashboard. An event that is handled in code but not subscribed never arrives: for disputes
 * that means a payout is released without the dispute hold (only the release check at transfer time still catches an
 * OPEN dispute; a dispute opened after the transfer would never be recorded).
 *
 * Pure (no Stripe, no Prisma): read by `scripts/verify-stripe-webhook-events.ts` and pinned against the processor's
 * `case` labels by `lib/__tests__/stripe-webhook-required-events.test.ts`, so the two cannot drift.
 */
export const STRIPE_WEBHOOK_REQUIRED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "account.updated",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const

export type StripeWebhookRequiredEvent = (typeof STRIPE_WEBHOOK_REQUIRED_EVENTS)[number]

/** Events whose absence leaves money unprotected (refund and dispute holds, payout release). */
export const STRIPE_WEBHOOK_MONEY_CRITICAL_EVENTS: readonly StripeWebhookRequiredEvent[] = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]

export type WebhookEndpointLike = { url: string; status?: string | null; enabled_events: readonly string[] }

export type SubscriptionCheck = {
  endpoint: string
  enabled: boolean
  missing: StripeWebhookRequiredEvent[]
  missingMoneyCritical: StripeWebhookRequiredEvent[]
}

/** Which required events an endpoint does not receive (`*` subscribes to everything). */
export function checkEndpointSubscription(endpoint: WebhookEndpointLike): SubscriptionCheck {
  const all = endpoint.enabled_events.includes("*")
  const missing = all ? [] : STRIPE_WEBHOOK_REQUIRED_EVENTS.filter((e) => !endpoint.enabled_events.includes(e))
  return {
    endpoint: endpoint.url,
    enabled: (endpoint.status ?? "enabled") === "enabled",
    missing,
    missingMoneyCritical: missing.filter((e) => STRIPE_WEBHOOK_MONEY_CRITICAL_EVENTS.includes(e)),
  }
}
