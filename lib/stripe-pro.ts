import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export { appBaseUrl } from "@/lib/app-base-url"

export const PRO_VIDEO_QUOTA = 999_999
export const FREE_VIDEO_QUOTA = 3

const ACTIVE_PRO_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"])

function checkoutCustomerId(session: Stripe.Checkout.Session): string | null {
  return typeof session.customer === "string" ? session.customer : session.customer?.id ?? null
}

function subscriptionIdFromCheckout(session: Stripe.Checkout.Session): string | null {
  return typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null
}

function customerIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null
}

export function resolveStripeProPriceId(): string | null {
  const id = process.env.STRIPE_PRO_PRICE_ID?.trim()
  return id || null
}

/** True when subscription line items include the configured Video Pro Stripe price. */
export function subscriptionHasProPrice(subscription: Stripe.Subscription): boolean {
  const expected = resolveStripeProPriceId()
  if (!expected) return false
  return subscription.items.data.some((item) => item.price?.id === expected)
}

export function isActiveProSubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return ACTIVE_PRO_SUBSCRIPTION_STATUSES.has(status)
}

/** Resolve Affisell user from Checkout metadata (preferred) or customer email. */
export async function resolveUserIdForProCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMeta = session.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const email =
    session.customer_email?.trim() ||
    session.customer_details?.email?.trim() ||
    null
  if (!email) return null

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  return byEmail?.id ?? null
}

async function resolveUserIdForProSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const customerId = customerIdFromSubscription(subscription)
  if (!customerId) return null

  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return byCustomer?.id ?? null
}

export function isProSubscriptionCheckout(session: Stripe.Checkout.Session): boolean {
  if (session.mode !== "subscription") return false
  if (session.payment_status !== "paid") return false
  return true
}

export async function activateProFromSubscription(subscription: Stripe.Subscription) {
  if (!subscriptionHasProPrice(subscription)) {
    return { activated: false as const, reason: "not_pro_price" }
  }
  if (!isActiveProSubscriptionStatus(subscription.status)) {
    return { activated: false as const, reason: "inactive_status" }
  }

  const userId = await resolveUserIdForProSubscription(subscription)
  if (!userId) {
    return { activated: false as const, reason: "user_not_found" }
  }

  const customerId = customerIdFromSubscription(subscription)

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscription.id,
      proActivatedAt: new Date(),
    },
  })

  console.log("[video-paywall]", {
    userId,
    subscriptionId: subscription.id,
    result: "activated",
  })

  return { activated: true as const, userId }
}

export async function activateProFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isProSubscriptionCheckout(session)) {
    return { activated: false as const, reason: "not_paid_subscription" }
  }

  if (!resolveStripeProPriceId()) {
    console.warn("[video-paywall] STRIPE_PRO_PRICE_ID missing — skip Pro activation")
    return { activated: false as const, reason: "pro_price_not_configured" }
  }

  const subscriptionId = subscriptionIdFromCheckout(session)
  if (!subscriptionId) {
    return { activated: false as const, reason: "no_subscription" }
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (!subscriptionHasProPrice(subscription)) {
    console.log("[video-paywall]", {
      sessionId: session.id,
      subscriptionId,
      result: "skipped_wrong_price",
    })
    return { activated: false as const, reason: "not_pro_price" }
  }

  const userId = await resolveUserIdForProCheckout(session)
  if (!userId) {
    throw new Error(
      "checkout.session.completed: could not resolve user (metadata.userId or customer_email)"
    )
  }

  const customerId = checkoutCustomerId(session)

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscriptionId,
      proActivatedAt: new Date(),
    },
  })

  console.log("[video-paywall]", {
    userId,
    sessionId: session.id,
    subscriptionId,
    result: "activated",
  })

  return { activated: true as const, userId }
}

export async function deactivateProFromSubscription(subscription: Stripe.Subscription) {
  if (!subscriptionHasProPrice(subscription)) {
    return { updated: 0, skipped: true as const }
  }

  const customerId = customerIdFromSubscription(subscription)
  const subId = subscription.id

  const result = await prisma.user.updateMany({
    where: {
      OR: [
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
        { stripeSubscriptionId: subId },
      ],
    },
    data: {
      isPro: false,
      videoQuota: FREE_VIDEO_QUOTA,
      stripeSubscriptionId: null,
    },
  })

  console.log("[video-paywall]", {
    subscriptionId: subId,
    updated: result.count,
    result: "deactivated",
  })

  return { updated: result.count, skipped: false as const }
}

export async function syncProFromSubscriptionUpdate(subscription: Stripe.Subscription) {
  if (!subscriptionHasProPrice(subscription)) {
    return { action: "skipped" as const, reason: "not_pro_price" }
  }

  if (isActiveProSubscriptionStatus(subscription.status)) {
    const activated = await activateProFromSubscription(subscription)
    return activated.activated
      ? { action: "activated" as const, userId: activated.userId }
      : { action: "skipped" as const, reason: activated.reason }
  }

  const deactivated = await deactivateProFromSubscription(subscription)
  return { action: "deactivated" as const, updated: deactivated.updated }
}
