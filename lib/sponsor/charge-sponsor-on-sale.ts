import "server-only"

import type { Prisma } from "@prisma/client"

import { SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"
import { isSponsorPlacement } from "@/lib/sponsor/sponsor-status-ui"
import { successFeeCentsForSale } from "@/lib/sponsor/sponsor-pricing"

type Tx = Prisma.TransactionClient

/**
 * After a paid marketplace order: accrue Affisell Boost SUCCESS_FEE on matching active campaigns.
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

  let chargedCents = 0
  const campaignIds: string[] = []

  for (const campaign of campaigns) {
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
