import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { SPONSOR_FLOW_METADATA, SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null
}

export async function activateSponsorCampaignFromCheckout(
  session: Stripe.Checkout.Session,
  tx: Prisma.TransactionClient
) {
  if (session.metadata?.flow !== SPONSOR_FLOW_METADATA) {
    return { activated: false as const, reason: "not_sponsor_flow" }
  }
  if (session.payment_status !== "paid") {
    return { activated: false as const, reason: "not_paid" }
  }

  const campaignId = session.metadata?.campaignId?.trim()
  if (!campaignId) {
    throw new Error("sponsor checkout missing campaignId metadata")
  }

  const existing = await tx.sponsorCampaign.findUnique({ where: { id: campaignId } })
  if (!existing) {
    throw new Error(`sponsor campaign not found: ${campaignId}`)
  }
  if (existing.status === SPONSOR_STATUS.ACTIVE) {
    return { activated: true as const, campaignId, duplicate: true }
  }

  const now = new Date()
  const endsAt = new Date(now.getTime() + existing.durationDays * 86_400_000)
  const pi = paymentIntentId(session)

  const updated = await tx.sponsorCampaign.update({
    where: { id: campaignId },
    data: {
      status: SPONSOR_STATUS.ACTIVE,
      startsAt: now,
      endsAt,
      stripeCheckoutSessionId: session.id,
      ...(pi ? { stripePaymentIntentId: pi } : {}),
    },
  })

  if (updated.affiliateProductId && updated.setsListingFeatured) {
    await tx.affiliateProduct.update({
      where: { id: updated.affiliateProductId },
      data: { isFeatured: true },
    })
  }

  console.log("[sponsor]", {
    campaignId: updated.id,
    payerRole: updated.payerRole,
    placement: updated.placement,
    feeCents: updated.feeCents,
    endsAt: updated.endsAt?.toISOString(),
    result: "activated",
  })

  return { activated: true as const, campaignId: updated.id, duplicate: false }
}

export function isSponsorCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.flow === SPONSOR_FLOW_METADATA
}
