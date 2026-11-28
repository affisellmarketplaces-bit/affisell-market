import type Stripe from "stripe"

/**
 * Subscription state guard — a plan (Pro, Radar, Growth) is granted or removed from the subscription's CURRENT state at
 * Stripe, never from the copy inside a webhook event.
 *
 * Why: Stripe does not deliver events in order and retries them for days. A `customer.subscription.updated` carrying
 * `status: "active"` that arrives AFTER `customer.subscription.deleted` (or a late `checkout.session.completed`)
 * used to re-grant a plan that was cancelled. Re-reading the subscription makes every delivery — repeated, delayed,
 * concurrent, out of order — converge on the same answer: what Stripe says now.
 *
 * A failed read throws (the webhook is recorded failed and Stripe retries): acting on a stale copy is worse than
 * acting later.
 */
export const ENTITLING_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(["active", "trialing"])

export type CurrentSubscription =
  | { kind: "current"; subscription: Stripe.Subscription; entitled: boolean }
  /** Stripe no longer knows the subscription (deleted): never entitling. */
  | { kind: "gone" }

export type SubscriptionRetriever = (id: string) => Promise<Stripe.Subscription>

function isResourceMissing(e: unknown): boolean {
  const err = e as { code?: string; statusCode?: number; raw?: { code?: string } } | null
  return Boolean(
    err && (err.code === "resource_missing" || err.raw?.code === "resource_missing" || err.statusCode === 404),
  )
}

export async function readCurrentSubscription(
  id: string,
  retrieve: SubscriptionRetriever,
): Promise<CurrentSubscription> {
  try {
    const subscription = await retrieve(id)
    return { kind: "current", subscription, entitled: ENTITLING_SUBSCRIPTION_STATUSES.has(subscription.status) }
  } catch (e) {
    if (isResourceMissing(e)) return { kind: "gone" }
    throw e
  }
}

export type SubscriptionTransition = "grant_or_refresh" | "remove"

/**
 * Decides what a subscription event may do, from the current state only. The event type and its embedded status are
 * logged for the trace but do not decide.
 */
export function decideSubscriptionTransition(current: CurrentSubscription): SubscriptionTransition {
  return current.kind === "current" && current.entitled ? "grant_or_refresh" : "remove"
}

export function logSubscriptionTransition(payload: {
  eventId?: string
  eventType: string
  subscriptionId: string
  eventStatus: string | null
  current: CurrentSubscription
  transition: SubscriptionTransition
}): void {
  const currentStatus = payload.current.kind === "current" ? payload.current.subscription.status : "gone"
  console.log("[subscription-state]", {
    eventId: payload.eventId ?? null,
    eventType: payload.eventType,
    subscriptionId: payload.subscriptionId,
    eventStatus: payload.eventStatus,
    currentStatus,
    stale: payload.eventStatus !== null && payload.eventStatus !== currentStatus,
    transition: payload.transition,
  })
}
