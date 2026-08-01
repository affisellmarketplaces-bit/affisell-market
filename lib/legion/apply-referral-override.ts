import "server-only"

import type { Prisma } from "@prisma/client"

import { calculateLegionSplit } from "@/lib/legion/split"

type Tx = Prisma.TransactionClient

/**
 * Phase1-safe Légion referral override (2% lifetime).
 * Deducts from filleul affiliate legs only — never creates parallel Connect transfers.
 * Sponsor Connect payout runs later via `payLegionOverrideForOrder` after affiliate release.
 */
export async function applyLegionReferralOverrideOnFulfill(
  tx: Tx,
  args: {
    orderId: string
    affiliateId: string
    sellingPriceCents: number
  }
): Promise<{ applied: boolean; overrideCents: number; sponsorId: string | null }> {
  const profile = await tx.storeProfile.findUnique({
    where: { userId: args.affiliateId },
    select: { id: true },
  })
  if (!profile) {
    return { applied: false, overrideCents: 0, sponsorId: null }
  }

  const order = await tx.order.findUnique({
    where: { id: args.orderId },
    select: {
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      commissionCents: true,
      legionOverrideAmount: true,
      legionPayoutStatus: true,
    },
  })
  if (!order) {
    return { applied: false, overrideCents: 0, sponsorId: null }
  }

  // Idempotent: already reserved/applied.
  const existingOverride = Number(order.legionOverrideAmount ?? 0)
  if (existingOverride > 0 && order.legionPayoutStatus && order.legionPayoutStatus !== "pending") {
    return {
      applied: true,
      overrideCents: Math.round(existingOverride * 100),
      sponsorId: null,
    }
  }

  const priceEur = Math.max(0, args.sellingPriceCents) / 100
  const affiliatePoolCents = order.affiliatePayoutCents + order.affiliateMarginRetainedCents
  const marginRate =
    args.sellingPriceCents > 0 ? Math.min(1, Math.max(0, affiliatePoolCents / args.sellingPriceCents)) : 0

  const split = await calculateLegionSplit({
    supabase: tx,
    product_price: priceEur,
    seller_margin_rate: marginRate,
    store_profile_id: profile.id,
  })

  if (!split.sponsor_id || split.legion_override <= 0) {
    await tx.order.update({
      where: { id: args.orderId },
      data: { storeProfileId: profile.id },
    })
    return { applied: false, overrideCents: 0, sponsorId: null }
  }

  const overrideCents = Math.round(split.legion_override * 100)
  if (overrideCents <= 0) {
    await tx.order.update({
      where: { id: args.orderId },
      data: { storeProfileId: profile.id },
    })
    return { applied: false, overrideCents: 0, sponsorId: split.sponsor_id }
  }

  const applied = Math.min(overrideCents, Math.max(0, affiliatePoolCents))
  const fromCommission = Math.min(applied, order.affiliatePayoutCents)
  const fromMargin = applied - fromCommission

  await tx.order.update({
    where: { id: args.orderId },
    data: {
      storeProfileId: profile.id,
      legionOverrideAmount: split.legion_override,
      legionPayoutStatus: "reserved",
      affiliatePayoutCents: order.affiliatePayoutCents - fromCommission,
      affiliateMarginRetainedCents: Math.max(0, order.affiliateMarginRetainedCents - fromMargin),
      commissionCents: Math.max(0, order.commissionCents - fromCommission),
    },
  })

  console.log("[legion]", {
    result: "override_reserved",
    orderId: args.orderId,
    overrideCents: applied,
    sponsorId: split.sponsor_id,
    storeProfileId: profile.id,
  })

  return {
    applied: applied > 0,
    overrideCents: applied,
    sponsorId: split.sponsor_id,
  }
}
