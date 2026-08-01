import "server-only"

import type { Prisma } from "@prisma/client"

import { SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"
import { isSponsorPlacement } from "@/lib/sponsor/sponsor-status-ui"
import { successFeeCentsForSale } from "@/lib/sponsor/sponsor-pricing"

type Tx = Prisma.TransactionClient

type CampaignRow = {
  id: string
  payerRole: string
  payerUserId: string
  sponsorRateBps: number
  placement: string
}

/**
 * At most one SUCCESS_FEE charge per payerRole on an order (highest rate wins).
 * Prevents stacked ACTIVE campaigns from double-billing HT.
 */
function pickCampaignsPerPayerRole(campaigns: CampaignRow[]): CampaignRow[] {
  const best = new Map<string, CampaignRow>()
  for (const c of campaigns) {
    const prev = best.get(c.payerRole)
    if (!prev || c.sponsorRateBps > prev.sponsorRateBps) {
      best.set(c.payerRole, c)
    }
  }
  return [...best.values()]
}

/**
 * After a paid marketplace order: accrue Affisell Placement SUCCESS_FEE on matching active campaigns.
 * Idempotent on (orderId, campaignId). Deducts from payer's Connect payout snapshot on the order.
 */
export async function accrueSponsorSuccessFeesForOrder(
  tx: Tx,
  args: {
    orderId: string
    productId: string
    affiliateProductId: string | null
    htCents: number
    supplierId: string
    affiliateId: string
  }
): Promise<{ chargedCents: number; campaignIds: string[] }> {
  const now = new Date()
  const campaigns = await tx.sponsorCampaign.findMany({
    where: {
      status: SPONSOR_STATUS.ACTIVE,
      billingMode: "SUCCESS_FEE",
      endsAt: { gt: now },
      OR: [
        { productId: args.productId, payerRole: "SUPPLIER" },
        ...(args.affiliateProductId
          ? [{ affiliateProductId: args.affiliateProductId, payerRole: "AFFILIATE" as const }]
          : []),
      ],
    },
    select: {
      id: true,
      payerRole: true,
      payerUserId: true,
      sponsorRateBps: true,
      placement: true,
    },
  })

  if (campaigns.length === 0) {
    return { chargedCents: 0, campaignIds: [] }
  }

  const selected = pickCampaignsPerPayerRole(campaigns)
  let chargedCents = 0
  const campaignIds: string[] = []

  for (const campaign of selected) {
    if (!isSponsorPlacement(campaign.placement)) continue

    const feeCents = successFeeCentsForSale({
      htCents: args.htCents,
      sponsorRateBps: campaign.sponsorRateBps,
      placement: campaign.placement,
    })

    try {
      await tx.sponsorCampaignCharge.create({
        data: {
          campaignId: campaign.id,
          orderId: args.orderId,
          feeCents,
          htCents: args.htCents,
          status: "ACCRUED",
          reversedCents: 0,
        },
      })
    } catch {
      // Unique (orderId, campaignId) — already accrued (idempotent replay).
      continue
    }

    await tx.sponsorCampaign.update({
      where: { id: campaign.id },
      data: { accruedFeeCents: { increment: feeCents } },
    })

    // Deduct from the payer's Connect leg on this order (platform retains).
    if (campaign.payerRole === "SUPPLIER" && campaign.payerUserId === args.supplierId) {
      const order = await tx.order.findUnique({
        where: { id: args.orderId },
        select: { supplierPayoutCents: true, affisellFeeCents: true },
      })
      if (order) {
        const nextSupplier = Math.max(0, order.supplierPayoutCents - feeCents)
        const applied = order.supplierPayoutCents - nextSupplier
        await tx.order.update({
          where: { id: args.orderId },
          data: {
            supplierPayoutCents: nextSupplier,
            affisellFeeCents: order.affisellFeeCents + applied,
          },
        })
        chargedCents += applied
      }
    } else if (campaign.payerRole === "AFFILIATE" && campaign.payerUserId === args.affiliateId) {
      const order = await tx.order.findUnique({
        where: { id: args.orderId },
        select: {
          affiliatePayoutCents: true,
          affiliateMarginRetainedCents: true,
          affisellFeeCents: true,
        },
      })
      if (order) {
        const pool = order.affiliatePayoutCents + order.affiliateMarginRetainedCents
        const applied = Math.min(feeCents, Math.max(0, pool))
        const fromCommission = Math.min(applied, order.affiliatePayoutCents)
        const fromMargin = applied - fromCommission
        await tx.order.update({
          where: { id: args.orderId },
          data: {
            affiliatePayoutCents: order.affiliatePayoutCents - fromCommission,
            affiliateMarginRetainedCents: Math.max(
              0,
              order.affiliateMarginRetainedCents - fromMargin
            ),
            affisellFeeCents: order.affisellFeeCents + applied,
          },
        })
        chargedCents += applied
      }
    }

    campaignIds.push(campaign.id)
    console.log("[sponsor]", {
      result: "success_fee_accrued",
      orderId: args.orderId,
      campaignId: campaign.id,
      feeCents,
    })
  }

  return { chargedCents, campaignIds }
}

/**
 * Refund clawback for Affisell Placement SUCCESS_FEE.
 * `fraction` = share of order already refunded (0–1). Idempotent via reversedCents.
 * Connect clawback of payouts is handled separately by existing refund rails.
 */
export async function reverseSponsorSuccessFeesForOrder(
  orderId: string,
  opts?: { fraction?: number }
): Promise<{ reversedCents: number; chargeIds: string[] }> {
  const fraction = Math.min(1, Math.max(0, opts?.fraction ?? 1))
  if (fraction <= 0) return { reversedCents: 0, chargeIds: [] }

  const { prisma } = await import("@/lib/prisma")
  const charges = await prisma.sponsorCampaignCharge.findMany({
    where: {
      orderId,
      OR: [{ status: "ACCRUED" }, { status: "REVERSED", reversedCents: { gt: 0 } }],
    },
    select: { id: true, campaignId: true, feeCents: true, reversedCents: true, status: true },
  })
  if (charges.length === 0) return { reversedCents: 0, chargeIds: [] }

  let reversedCents = 0
  const chargeIds: string[] = []

  for (const charge of charges) {
    const targetReversed = Math.min(
      charge.feeCents,
      Math.max(0, Math.round(charge.feeCents * fraction))
    )
    const undo = Math.max(0, targetReversed - charge.reversedCents)
    if (undo <= 0) continue

    const nextReversed = charge.reversedCents + undo
    const nextStatus = nextReversed >= charge.feeCents ? "REVERSED" : "ACCRUED"

    const updated = await prisma.sponsorCampaignCharge.updateMany({
      where: {
        id: charge.id,
        reversedCents: charge.reversedCents,
      },
      data: {
        reversedCents: nextReversed,
        status: nextStatus,
      },
    })
    if (updated.count === 0) continue

    await prisma.sponsorCampaign.update({
      where: { id: charge.campaignId },
      data: { accruedFeeCents: { decrement: undo } },
    })

    const orderRow = await prisma.order.findUnique({
      where: { id: orderId },
      select: { affisellFeeCents: true },
    })
    if (orderRow) {
      await prisma.order.update({
        where: { id: orderId },
        data: { affisellFeeCents: Math.max(0, orderRow.affisellFeeCents - undo) },
      })
    }

    reversedCents += undo
    chargeIds.push(charge.id)
    console.log("[sponsor]", {
      result: "success_fee_reversed",
      orderId,
      campaignId: charge.campaignId,
      chargeId: charge.id,
      undo,
      fraction,
      reversedCents: nextReversed,
      status: nextStatus,
    })
  }

  return { reversedCents, chargeIds }
}
