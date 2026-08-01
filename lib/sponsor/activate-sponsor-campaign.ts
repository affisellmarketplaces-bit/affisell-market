import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { SPONSOR_FLOW_METADATA, SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null
}

/** Expire other ACTIVE SUCCESS_FEE campaigns on the same product + payerRole (no double bill). */
async function supersedeSiblingSuccessFeeCampaigns(
  tx: Prisma.TransactionClient,
  campaign: {
    id: string
    productId: string
    payerRole: string
    affiliateProductId: string | null
    billingMode: string
  },
  now: Date
) {
  if (campaign.billingMode !== "SUCCESS_FEE") return

  const where = {
    status: SPONSOR_STATUS.ACTIVE,
    billingMode: "SUCCESS_FEE" as const,
    payerRole: campaign.payerRole,
    productId: campaign.productId,
    id: { not: campaign.id },
    ...(campaign.payerRole === "AFFILIATE" && campaign.affiliateProductId
      ? { affiliateProductId: campaign.affiliateProductId }
      : {}),
  }

  const result = await tx.sponsorCampaign.updateMany({
    where,
    data: { status: SPONSOR_STATUS.EXPIRED, endsAt: now },
  })
  if (result.count > 0) {
    console.log("[sponsor]", {
      result: "superseded_sibling_success_fee",
      campaignId: campaign.id,
      expiredCount: result.count,
      productId: campaign.productId,
      payerRole: campaign.payerRole,
    })
  }
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

  await supersedeSiblingSuccessFeeCampaigns(tx, existing, now)

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

/** Activate SUCCESS_FEE campaign immediately (no Stripe Checkout). Idempotent. */
export async function activateSponsorCampaignSuccessFee(
  campaignId: string,
  tx: Prisma.TransactionClient
) {
  const existing = await tx.sponsorCampaign.findUnique({ where: { id: campaignId } })
  if (!existing) {
    throw new Error(`sponsor campaign not found: ${campaignId}`)
  }
  if (existing.status === SPONSOR_STATUS.ACTIVE) {
    return { activated: true as const, campaignId, duplicate: true }
  }

  const now = new Date()
  const endsAt = new Date(now.getTime() + existing.durationDays * 86_400_000)

  await supersedeSiblingSuccessFeeCampaigns(
    tx,
    { ...existing, billingMode: "SUCCESS_FEE" },
    now
  )

  const updated = await tx.sponsorCampaign.update({
    where: { id: campaignId },
    data: {
      status: SPONSOR_STATUS.ACTIVE,
      billingMode: "SUCCESS_FEE",
      startsAt: now,
      endsAt,
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
    billingMode: "SUCCESS_FEE",
    result: "activated_success_fee",
    endsAt: updated.endsAt?.toISOString(),
  })

  return { activated: true as const, campaignId: updated.id, duplicate: false }
}

export function isSponsorCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.flow === SPONSOR_FLOW_METADATA
}
