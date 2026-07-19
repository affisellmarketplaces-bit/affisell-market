import type Stripe from "stripe"

import type { RadarCheckoutPlanId } from "@/lib/radar/plans"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { PRO_VIDEO_QUOTA } from "@/lib/stripe-pro"

export type { RadarCheckoutPlanId }

const ACTIVE_SUB_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"])

export function resolveStripeRadarProPriceId(): string | null {
  const radar = process.env.STRIPE_RADAR_PRO_PRICE_ID?.trim()
  if (radar) return radar
  const fallback = process.env.STRIPE_PRO_PRICE_ID?.trim()
  return fallback || null
}

export function resolveStripeRadarGlobalPriceId(): string | null {
  const id = process.env.STRIPE_RADAR_GLOBAL_PRICE_ID?.trim()
  return id || null
}

/** True when Global $99 checkout can be created (price id present). */
export function isStripeRadarGlobalConfigured(): boolean {
  return Boolean(resolveStripeRadarGlobalPriceId())
}

export function resolveRadarStripePriceId(plan: RadarCheckoutPlanId): string | null {
  return plan === "global" ? resolveStripeRadarGlobalPriceId() : resolveStripeRadarProPriceId()
}

export function parseRadarCheckoutPlan(raw: unknown): RadarCheckoutPlanId | null {
  if (raw === "pro" || raw === "radar_pro") return "pro"
  if (raw === "global" || raw === "radar_global") return "global"
  return null
}

function subscriptionPriceIds(subscription: Stripe.Subscription): string[] {
  return subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
}

export function radarPlanFromSubscription(subscription: Stripe.Subscription): RadarCheckoutPlanId | null {
  const fromMeta = parseRadarCheckoutPlan(subscription.metadata?.plan)
  if (fromMeta) return fromMeta

  const prices = subscriptionPriceIds(subscription)
  const globalId = resolveStripeRadarGlobalPriceId()
  if (globalId && prices.includes(globalId)) return "global"

  const proId = resolveStripeRadarProPriceId()
  if (proId && prices.includes(proId)) return "pro"

  return null
}

export function subscriptionHasRadarPrice(subscription: Stripe.Subscription): boolean {
  return radarPlanFromSubscription(subscription) !== null
}

function checkoutCustomerId(session: Stripe.Checkout.Session): string | null {
  return typeof session.customer === "string" ? session.customer : session.customer?.id ?? null
}

function subscriptionIdFromCheckout(session: Stripe.Checkout.Session): string | null {
  return typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null
}

async function resolveUserIdFromCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMeta = session.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const email =
    session.customer_email?.trim() || session.customer_details?.email?.trim() || null
  if (!email) return null

  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return byEmail?.id ?? null
}

async function resolveUserIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null
  if (!customerId) return null

  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return byCustomer?.id ?? null
}

/** Safe return path after Radar Stripe checkout. */
export function sanitizeRadarReturnPath(raw: unknown): string {
  if (typeof raw !== "string") return "/radar"
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return "/radar"
  }
  const path = trimmed.split("?")[0]?.split("#")[0] ?? "/radar"
  if (
    path === "/pricing" ||
    path.startsWith("/pricing/") ||
    path === "/radar" ||
    path.startsWith("/radar/") ||
    path === "/admin/radar" ||
    path.startsWith("/admin/radar/")
  ) {
    return path
  }
  return "/radar"
}

export async function activateRadarFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || session.payment_status !== "paid") {
    return { activated: false as const, reason: "not_paid_subscription" }
  }

  const planFromMeta = parseRadarCheckoutPlan(session.metadata?.plan)
  const feature = session.metadata?.feature?.trim()
  const looksLikeRadar = planFromMeta !== null || feature === "radar"
  if (!looksLikeRadar) {
    return { activated: false as const, reason: "not_radar_checkout" }
  }

  const subscriptionId = subscriptionIdFromCheckout(session)
  if (!subscriptionId) {
    return { activated: false as const, reason: "no_subscription" }
  }

  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const plan = planFromMeta ?? radarPlanFromSubscription(subscription)
  if (!plan) {
    console.log("[radar-paywall]", {
      sessionId: session.id,
      subscriptionId,
      result: "skipped_unknown_plan",
    })
    return { activated: false as const, reason: "unknown_plan" }
  }

  // Metadata from our Checkout Session is authoritative. Env price id is a
  // secondary check for webhooks that only carry subscription price ids.
  if (!planFromMeta) {
    let expectedPrice = resolveRadarStripePriceId(plan)
    if (!expectedPrice && plan === "global") {
      const { resolveOrEnsureStripeRadarGlobalPriceId } = await import("@/lib/stripe-radar-ensure")
      expectedPrice = await resolveOrEnsureStripeRadarGlobalPriceId()
    }
    if (!expectedPrice) {
      console.warn("[radar-paywall] Stripe Radar price missing", { plan })
      return { activated: false as const, reason: "price_not_configured" }
    }

    if (!subscriptionPriceIds(subscription).includes(expectedPrice)) {
      return { activated: false as const, reason: "wrong_price" }
    }
  } else if (subscriptionPriceIds(subscription).length === 0) {
    return { activated: false as const, reason: "no_price_on_subscription" }
  }

  const userId = await resolveUserIdFromCheckout(session)
  if (!userId) {
    throw new Error(
      "radar checkout.session.completed: could not resolve user (metadata.userId or customer_email)"
    )
  }

  const customerId = checkoutCustomerId(session)

  await prisma.user.update({
    where: { id: userId },
    data: {
      radarPlan: plan,
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscriptionId,
      proActivatedAt: new Date(),
    },
  })

  console.log("[radar-paywall]", {
    userId,
    sessionId: session.id,
    subscriptionId,
    plan,
    result: "activated",
  })

  return { activated: true as const, userId, plan }
}

export async function syncRadarFromSubscription(subscription: Stripe.Subscription) {
  const plan = radarPlanFromSubscription(subscription)
  if (!plan) {
    return { updated: 0, skipped: true as const, reason: "not_radar_price" }
  }

  const userId = await resolveUserIdFromSubscription(subscription)
  if (!userId) {
    return { updated: 0, skipped: true as const, reason: "user_not_found" }
  }

  if (!ACTIVE_SUB_STATUSES.has(subscription.status)) {
    await prisma.user.update({
      where: { id: userId },
      data: { radarPlan: "free" },
    })
    console.log("[radar-paywall]", {
      userId,
      subscriptionId: subscription.id,
      result: "deactivated_inactive",
    })
    return { updated: 1, skipped: false as const, plan: "free" as const }
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null

  await prisma.user.update({
    where: { id: userId },
    data: {
      radarPlan: plan,
      isPro: true,
      videoQuota: PRO_VIDEO_QUOTA,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscription.id,
      proActivatedAt: new Date(),
    },
  })

  console.log("[radar-paywall]", {
    userId,
    subscriptionId: subscription.id,
    plan,
    result: "synced",
  })

  return { updated: 1, skipped: false as const, plan }
}

export async function deactivateRadarFromSubscription(subscription: Stripe.Subscription) {
  if (!subscriptionHasRadarPrice(subscription)) {
    return { updated: 0, skipped: true as const }
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null
  const subId = subscription.id

  const result = await prisma.user.updateMany({
    where: {
      OR: [
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
        { stripeSubscriptionId: subId },
      ],
      radarPlan: { in: ["pro", "global"] },
    },
    data: { radarPlan: "free" },
  })

  console.log("[radar-paywall]", {
    subscriptionId: subId,
    updated: result.count,
    result: "deactivated",
  })

  return { updated: result.count, skipped: false as const }
}
