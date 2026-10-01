import type Stripe from "stripe"

import {
  GROWTH_PRICING_TIERS,
  isGrowthPricingTierId,
  type GrowthPricingTierId,
} from "@/lib/growth-pricing-tiers"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import type { GrowthBillingInterval } from "@/lib/stripe-growth-ensure"

const ACTIVE_SUB_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"])

export function parseGrowthCheckoutPlan(raw: unknown): GrowthPricingTierId | null {
  return typeof raw === "string" && isGrowthPricingTierId(raw) ? raw : null
}

export function parseGrowthBillingInterval(raw: unknown): GrowthBillingInterval | null {
  return raw === "monthly" || raw === "annual" ? raw : null
}

function subscriptionPriceIds(subscription: Stripe.Subscription): string[] {
  return subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
}

/** Plan from subscription metadata (authoritative) — price-id matching needs the async price resolver, see activateGrowthFromCheckoutSession. */
function growthPlanFromMetadata(subscription: Stripe.Subscription): GrowthPricingTierId | null {
  return parseGrowthCheckoutPlan(subscription.metadata?.growthPlan)
}

export function subscriptionHasGrowthPrice(subscription: Stripe.Subscription): boolean {
  return subscription.metadata?.feature === "growth" && growthPlanFromMetadata(subscription) !== null
}

function checkoutCustomerId(session: Stripe.Checkout.Session): string | null {
  return typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null)
}

function subscriptionIdFromCheckout(session: Stripe.Checkout.Session): string | null {
  return typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription?.id ?? null)
}

async function resolveUserIdFromCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMeta = session.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const email = session.customer_email?.trim() || session.customer_details?.email?.trim() || null
  if (!email) return null

  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return byEmail?.id ?? null
}

async function resolveUserIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMeta = subscription.metadata?.userId?.trim()
  if (fromMeta) {
    const byId = await prisma.user.findUnique({ where: { id: fromMeta }, select: { id: true } })
    if (byId) return byId.id
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : (subscription.customer?.id ?? null)
  if (!customerId) return null

  const byCustomer = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } })
  return byCustomer?.id ?? null
}

/** Safe return path after a Growth Stripe checkout. */
export function sanitizeGrowthReturnPath(raw: unknown): string {
  if (typeof raw !== "string") return "/pricing"
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return "/pricing"
  }
  const path = trimmed.split("?")[0]?.split("#")[0] ?? "/pricing"
  if (
    path === "/pricing" ||
    path.startsWith("/pricing/") ||
    path.startsWith("/dashboard/") ||
    path.startsWith("/signup/")
  ) {
    return path
  }
  return "/pricing"
}

export async function activateGrowthFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || session.payment_status !== "paid") {
    return { activated: false as const, reason: "not_paid_subscription" }
  }

  const feature = session.metadata?.feature?.trim()
  const planFromMeta = parseGrowthCheckoutPlan(session.metadata?.growthPlan)
  if (feature !== "growth" || !planFromMeta) {
    return { activated: false as const, reason: "not_growth_checkout" }
  }

  const subscriptionId = subscriptionIdFromCheckout(session)
  if (!subscriptionId) {
    return { activated: false as const, reason: "no_subscription" }
  }

  const interval = parseGrowthBillingInterval(session.metadata?.growthInterval) ?? "monthly"

  // Verify the subscription was actually billed at the expected price — metadata alone
  // (session.metadata.growthPlan) must never be trusted to grant a tier without confirming
  // the money matches, the same guard Radar's activation applies via subscriptionHasRadarPrice.
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const { resolveOrEnsureStripeGrowthPriceId } = await import("@/lib/stripe-growth-ensure")
  const expectedPrice = await resolveOrEnsureStripeGrowthPriceId(planFromMeta, interval)
  if (!expectedPrice || !subscriptionPriceIds(subscription).includes(expectedPrice)) {
    console.warn("[growth-paywall]", {
      sessionId: session.id,
      subscriptionId,
      plan: planFromMeta,
      interval,
      result: "price_mismatch",
    })
    return { activated: false as const, reason: "price_mismatch" }
  }

  const userId = await resolveUserIdFromCheckout(session)
  if (!userId) {
    throw new Error(
      "growth checkout.session.completed: could not resolve user (metadata.userId or customer_email)"
    )
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  const expectedRole = GROWTH_PRICING_TIERS[planFromMeta].role
  if (!user || user.role !== expectedRole) {
    console.warn("[growth-paywall]", {
      userId,
      sessionId: session.id,
      plan: planFromMeta,
      result: "role_mismatch",
      expectedRole,
      actualRole: user?.role ?? null,
    })
    return { activated: false as const, reason: "role_mismatch" }
  }

  const customerId = checkoutCustomerId(session)

  await prisma.user.update({
    where: { id: userId },
    data: {
      growthPlan: planFromMeta,
      growthPlanInterval: interval,
      growthPlanActivatedAt: new Date(),
      growthStripeSubscriptionId: subscriptionId,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  })

  console.log("[growth-paywall]", {
    userId,
    sessionId: session.id,
    subscriptionId,
    plan: planFromMeta,
    interval,
    result: "activated",
  })

  return { activated: true as const, userId, plan: planFromMeta }
}

export async function syncGrowthFromSubscription(subscription: Stripe.Subscription) {
  if (subscription.metadata?.feature !== "growth") {
    return { updated: 0, skipped: true as const, reason: "not_growth_subscription" }
  }

  const plan = growthPlanFromMetadata(subscription)
  if (!plan) {
    return { updated: 0, skipped: true as const, reason: "unknown_plan" }
  }

  const userId = await resolveUserIdFromSubscription(subscription)
  if (!userId) {
    return { updated: 0, skipped: true as const, reason: "user_not_found" }
  }

  if (!ACTIVE_SUB_STATUSES.has(subscription.status)) {
    await prisma.user.update({ where: { id: userId }, data: { growthPlan: "none" } })
    console.log("[growth-paywall]", { userId, subscriptionId: subscription.id, result: "deactivated_inactive" })
    return { updated: 1, skipped: false as const, plan: "none" as const }
  }

  const interval = parseGrowthBillingInterval(subscription.metadata?.growthInterval) ?? "monthly"
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : (subscription.customer?.id ?? null)

  await prisma.user.update({
    where: { id: userId },
    data: {
      growthPlan: plan,
      growthPlanInterval: interval,
      growthPlanActivatedAt: new Date(),
      growthStripeSubscriptionId: subscription.id,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  })

  console.log("[growth-paywall]", { userId, subscriptionId: subscription.id, plan, result: "synced" })

  return { updated: 1, skipped: false as const, plan }
}

export async function deactivateGrowthFromSubscription(subscription: Stripe.Subscription) {
  if (!subscriptionHasGrowthPrice(subscription)) {
    return { updated: 0, skipped: true as const }
  }

  const subId = subscription.id

  const result = await prisma.user.updateMany({
    where: { growthStripeSubscriptionId: subId },
    data: { growthPlan: "none" },
  })

  console.log("[growth-paywall]", { subscriptionId: subId, updated: result.count, result: "deactivated" })

  return { updated: result.count, skipped: false as const }
}
