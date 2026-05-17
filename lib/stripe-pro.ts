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

export async function activateProFromCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId?.trim()
  if (!userId) {
    throw new Error("checkout.session.completed missing metadata.userId")
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      proActivatedAt: new Date(),
    },
  })
}

export async function deactivateProFromSubscription(subscription: Stripe.Subscription) {
  const subId = subscription.id
  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subId },
    data: {
      isPro: false,
      videoQuota: FREE_VIDEO_QUOTA,
      stripeSubscriptionId: null,
    },
  })
}
