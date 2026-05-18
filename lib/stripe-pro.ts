import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"

export const PRO_VIDEO_QUOTA = 999_999
export const FREE_VIDEO_QUOTA = 3

export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()
  if (!raw) return "http://localhost:3001"
  if (raw.startsWith("http")) return raw.replace(/\/$/, "")
  return `https://${raw.replace(/\/$/, "")}`
}

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

export function isProSubscriptionCheckout(session: Stripe.Checkout.Session): boolean {
  if (session.mode !== "subscription") return false
  if (session.payment_status !== "paid") return false
  return true
}

export async function activateProFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isProSubscriptionCheckout(session)) {
    return { activated: false as const, reason: "not_paid_subscription" }
  }

  const userId = await resolveUserIdForProCheckout(session)
  if (!userId) {
    throw new Error(
      "checkout.session.completed: could not resolve user (metadata.userId or customer_email)"
    )
  }

  const customerId = checkoutCustomerId(session)
  const subscriptionId = subscriptionIdFromCheckout(session)

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      proActivatedAt: new Date(),
    },
  })

  return { activated: true as const, userId }
}

export async function deactivateProFromSubscription(subscription: Stripe.Subscription) {
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

  return { updated: result.count }
}
