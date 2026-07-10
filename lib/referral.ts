import type { Prisma, PrismaClient } from "@prisma/client"

import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import {
  FILLEUL_WELCOME_BONUS_BPS,
  FILLEUL_WELCOME_DAYS,
  REFERRER_BONUS_BPS,
  UGC_BOUNTY_CENTS,
} from "@/lib/referral-shared"
import { prisma } from "@/lib/prisma"

type Db = PrismaClient | Prisma.TransactionClient

const MS_PER_DAY = 86_400_000

export const REFERRAL_LEDGER_REFERRER = "REFERRER_BONUS"
export const REFERRAL_LEDGER_FILLEUL = "FILLEUL_WELCOME"
export const REFERRAL_LEDGER_UGC = "UGC_BOUNTY"

function bonusFromNet(netCents: number, bps: number): number {
  const net = Math.max(0, Math.round(netCents))
  if (net === 0 || bps <= 0) return 0
  return Math.max(0, Math.floor((net * bps) / 10_000))
}

function affiliateNetFromOrder(order: {
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affiliateFeeCents: number
  affiliateMarginCents: number
}): number {
  return netAffiliateTransferCents({
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: order.affiliateMarginCents,
  })
}

function isWithinFilleulWelcomeWindow(createdAt: Date, now = new Date()): boolean {
  const ageMs = now.getTime() - createdAt.getTime()
  return ageMs >= 0 && ageMs < FILLEUL_WELCOME_DAYS * MS_PER_DAY
}

async function creditReferralBonusIdempotent(
  db: Db,
  args: {
    userId: string
    orderId: string | null
    amountCents: number
    entryType: string
    idempotencyKey: string
    note?: string | null
  }
): Promise<{ credited: boolean; amountCents: number }> {
  const amount = Math.max(0, Math.round(args.amountCents))
  if (amount === 0) return { credited: false, amountCents: 0 }

  const existing = await db.referralBonusLedger.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  })
  if (existing) return { credited: false, amountCents: existing.amountCents }

  await db.user.update({
    where: { id: args.userId },
    data: { referralBonusBalanceCents: { increment: amount } },
  })
  await db.referralBonusLedger.create({
    data: {
      userId: args.userId,
      orderId: args.orderId,
      entryType: args.entryType,
      amountCents: amount,
      idempotencyKey: args.idempotencyKey,
      note: args.note ?? null,
    },
  })
  return { credited: true, amountCents: amount }
}

export async function claimReferralCodeForUser(
  referralCode: string,
  userId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const code = referralCode.trim()
  if (!code) return { ok: false, reason: "missing_code" }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, role: true },
  })
  if (!referrer) return { ok: false, reason: "invalid_code" }
  if (referrer.id === userId) return { ok: false, reason: "self_referral" }
  if (referrer.role !== "AFFILIATE") return { ok: false, reason: "referrer_not_affiliate" }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  })
  if (!user) return { ok: false, reason: "user_not_found" }
  if (user.referredById) return { ok: true }

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrer.id },
  })

  console.log("[referral]", { userId, referrerId: referrer.id, result: "claimed" })
  return { ok: true }
}

export type ApplyReferralBonusResult = {
  orderId: string
  netAffiliateCents: number
  referrerBonusCents: number
  filleulBonusCents: number
  referrerCredited: boolean
  filleulCredited: boolean
}

/**
 * On paid affiliate sale: 10% net → parrain balance; 5% net → filleul if account < 30d.
 * Idempotent per order via ReferralBonusLedger keys.
 */
export async function applyReferralBonus(orderId: string): Promise<ApplyReferralBonusResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      affiliateId: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      affiliateMarginCents: true,
      referralBonusCents: true,
      affiliate: {
        select: {
          id: true,
          createdAt: true,
          referredById: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!order || order.status !== "paid" || !order.affiliate) return null

  const netAffiliateCents = affiliateNetFromOrder(order)
  if (netAffiliateCents <= 0) {
    console.log("[referral]", { orderId, result: "skipped_zero_net" })
    return {
      orderId,
      netAffiliateCents: 0,
      referrerBonusCents: 0,
      filleulBonusCents: 0,
      referrerCredited: false,
      filleulCredited: false,
    }
  }

  let referrerBonusCents = 0
  let filleulBonusCents = 0
  let referrerCredited = false
  let filleulCredited = false

  const referredById = order.affiliate.referredById
  if (referredById) {
    referrerBonusCents = bonusFromNet(netAffiliateCents, REFERRER_BONUS_BPS)
    const ref = await creditReferralBonusIdempotent(prisma, {
      userId: referredById,
      orderId,
      amountCents: referrerBonusCents,
      entryType: REFERRAL_LEDGER_REFERRER,
      idempotencyKey: `referral:referrer:${orderId}`,
      note: `10% filleul ${order.affiliate.id}`,
    })
    referrerCredited = ref.credited
    referrerBonusCents = ref.amountCents

    if (ref.credited && referrerBonusCents > 0) {
      const { sendAffiliateReferralBonusEmail } = await import(
        "@/lib/emails/send-affiliate-referral-bonus"
      )
      void sendAffiliateReferralBonusEmail({
        referrerUserId: referredById,
        filleulName:
          order.affiliate.name?.trim() ||
          order.affiliate.email?.split("@")[0] ||
          "ton filleul",
        amountCents: referrerBonusCents,
        orderId,
      }).catch((err: unknown) => {
        console.log("[referral]", {
          orderId,
          result: "referrer_email_failed",
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  if (isWithinFilleulWelcomeWindow(order.affiliate.createdAt) && order.referralBonusCents === 0) {
    filleulBonusCents = bonusFromNet(netAffiliateCents, FILLEUL_WELCOME_BONUS_BPS)
    const fil = await creditReferralBonusIdempotent(prisma, {
      userId: order.affiliate.id,
      orderId,
      amountCents: filleulBonusCents,
      entryType: REFERRAL_LEDGER_FILLEUL,
      idempotencyKey: `referral:filleul:${orderId}`,
      note: `Welcome bonus < ${FILLEUL_WELCOME_DAYS}d`,
    })
    filleulCredited = fil.credited
    filleulBonusCents = fil.amountCents
    if (fil.credited && filleulBonusCents > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: { referralBonusCents: filleulBonusCents },
      })
    }
  }

  console.log("[referral]", {
    orderId,
    netAffiliateCents,
    referrerBonusCents,
    filleulBonusCents,
    referrerCredited,
    filleulCredited,
  })

  return {
    orderId,
    netAffiliateCents,
    referrerBonusCents,
    filleulBonusCents,
    referrerCredited,
    filleulCredited,
  }
}

export async function approveReferralUgcClaim(args: {
  claimId: string
  adminUserId: string
}): Promise<{ ok: true; amountCents: number } | { ok: false; reason: string }> {
  const claim = await prisma.referralUgcClaim.findUnique({ where: { id: args.claimId } })
  if (!claim) return { ok: false, reason: "claim_not_found" }
  if (claim.status === "approved") return { ok: true, amountCents: claim.bonusCents }
  if (claim.status !== "pending") return { ok: false, reason: "claim_not_pending" }

  const idempotencyKey = `ugc:${claim.id}`
  const amountCents = Math.max(0, claim.bonusCents || UGC_BOUNTY_CENTS)

  await prisma.$transaction(async (tx) => {
    const locked = await tx.referralUgcClaim.findUnique({ where: { id: claim.id } })
    if (!locked || locked.status !== "pending") return

    await creditReferralBonusIdempotent(tx, {
      userId: locked.userId,
      orderId: null,
      amountCents,
      entryType: REFERRAL_LEDGER_UGC,
      idempotencyKey,
      note: locked.tweetUrl,
    })

    await tx.referralUgcClaim.update({
      where: { id: locked.id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedById: args.adminUserId,
        idempotencyKey,
        bonusCents: amountCents,
      },
    })
  })

  console.log("[referral]", {
    claimId: args.claimId,
    userId: claim.userId,
    amountCents,
    result: "ugc_approved",
  })

  return { ok: true, amountCents }
}

export async function loadReferralDashboardStats(userId: string): Promise<{
  referralCode: string
  referralCount: number
  earnedThisMonthCents: number
  balanceCents: number
  pendingUgcClaim: boolean
}> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [user, referralCount, earnedAgg, pendingClaim] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referralBonusBalanceCents: true },
    }),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referralBonusLedger.aggregate({
      where: {
        userId,
        createdAt: { gte: monthStart },
        entryType: { in: [REFERRAL_LEDGER_REFERRER, REFERRAL_LEDGER_UGC] },
      },
      _sum: { amountCents: true },
    }),
    prisma.referralUgcClaim.findFirst({
      where: { userId, status: "pending" },
      select: { id: true },
    }),
  ])

  return {
    referralCode: user?.referralCode ?? "",
    referralCount,
    earnedThisMonthCents: earnedAgg._sum.amountCents ?? 0,
    balanceCents: user?.referralBonusBalanceCents ?? 0,
    pendingUgcClaim: Boolean(pendingClaim),
  }
}
