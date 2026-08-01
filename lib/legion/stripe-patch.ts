import "server-only"

import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"
import {
  calculateLegionSplit,
  getPayoutDueAt,
  type LegionSplitResult,
} from "@/lib/legion/split"

export type LegionOrderInput = {
  id: string
  /** Buyer-facing product price in EUR */
  productPrice: number
  /** Affiliate margin rate 0–1 (e.g. 0.3 = 30%) */
  sellerMarginRate: number
  storeProfileId: string
  /** Stripe Connect account of the filleul (seller) */
  sellerStripeAccountId: string
  sourceTransaction?: string | null
}

export type LegionStripePatchResult = {
  split: LegionSplitResult
  sellerTransferId: string | null
  sponsorTransferId: string | null
  payoutDueAt: string
}

/**
 * Additive LÉGION Connect transfers — import into existing webhook/payout flows.
 * Does not replace Lightning or scheduleMarketplaceTransferAttempts.
 */
export async function handleAffisellLegionOrder(args: {
  /** Prisma client — named `supabase` for brief / SQL-spec compatibility. */
  supabase?: typeof prisma
  order: LegionOrderInput
  stripeClient?: Stripe
}): Promise<LegionStripePatchResult> {
  const db = args.supabase ?? prisma
  const stripe = args.stripeClient ?? getStripeClient()
  const order = args.order

  const split = await calculateLegionSplit({
    supabase: db,
    product_price: order.productPrice,
    seller_margin_rate: order.sellerMarginRate,
    store_profile_id: order.storeProfileId,
  })

  const payoutDueAt = getPayoutDueAt()
  let sellerTransferId: string | null = null
  let sponsorTransferId: string | null = null

  const sellerCents = Math.round(split.seller_earnings * 100)
  if (sellerCents > 0 && order.sellerStripeAccountId) {
    await assertTransfersActive(order.sellerStripeAccountId)
    const transfer = await stripe.transfers.create(
      {
        amount: sellerCents,
        currency: "eur",
        destination: order.sellerStripeAccountId,
        transfer_group: order.id,
        ...(order.sourceTransaction
          ? { source_transaction: order.sourceTransaction }
          : {}),
        metadata: {
          order_id: order.id,
          rail: "legion",
          role: "seller",
          fee: String(split.platform_fee),
          override: String(split.legion_override),
        },
      },
      { idempotencyKey: `legion_seller_${order.id}` }
    )
    sellerTransferId = transfer.id
  }

  if (split.sponsor_id && split.legion_override > 0) {
    const sponsorProfile = await db.storeProfile.findUnique({
      where: { id: split.sponsor_id },
      select: { id: true, username: true, userId: true },
    })
    const sponsorUser = sponsorProfile
      ? await db.user.findUnique({
          where: { id: sponsorProfile.userId },
          select: { stripeAccountId: true },
        })
      : null

    const sponsorCents = Math.round(split.legion_override * 100)
    if (sponsorUser?.stripeAccountId && sponsorCents > 0) {
      await assertTransfersActive(sponsorUser.stripeAccountId)
      const filleulLabel =
        (
          await db.storeProfile.findUnique({
            where: { id: order.storeProfileId },
            select: { username: true },
          })
        )?.username ?? "filleul"

      const transfer = await stripe.transfers.create(
        {
          amount: sponsorCents,
          currency: "eur",
          destination: sponsorUser.stripeAccountId,
          transfer_group: order.id,
          description: `Légion override 2% — filleul @${filleulLabel}`,
          metadata: {
            order_id: order.id,
            rail: "legion",
            role: "sponsor",
            override: String(split.legion_override),
            sponsor_id: split.sponsor_id,
          },
        },
        { idempotencyKey: `legion_sponsor_${order.id}` }
      )
      sponsorTransferId = transfer.id

      await db.legionReferral.updateMany({
        where: { referredId: order.storeProfileId, status: "active" },
        data: {
          totalOverrideEarned: { increment: split.legion_override },
        },
      })
    }
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      storeProfileId: order.storeProfileId,
      legionOverrideAmount: split.legion_override,
      legionPayoutStatus: "reserved",
      legionPayoutDueAt: new Date(payoutDueAt),
      legionSupplierAmount: split.supplier,
      legionReserveAmount: split.reserve,
      ...(sellerTransferId ? { stripeTransferId: sellerTransferId } : {}),
    },
  })

  console.log("[legion]", {
    orderId: order.id,
    result: "reserved",
    sellerTransferId,
    sponsorTransferId,
    override: split.legion_override,
  })

  return {
    split,
    sellerTransferId,
    sponsorTransferId,
    payoutDueAt,
  }
}
