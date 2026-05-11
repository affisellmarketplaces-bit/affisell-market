import type { Prisma, PrismaClient } from "@prisma/client"

const REDEEM = "REDEEMED"
const EARN = "EARNED"
const REVERSAL = "REVERSAL"

type Db = PrismaClient | Prisma.TransactionClient

export async function redeemBuyerRewardIdempotent(
  db: Db,
  args: { userId: string; amountCents: number; stripeSessionId: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const amount = Math.max(0, Math.round(args.amountCents))
  if (amount === 0) return { ok: true }
  const key = `redeem:${args.stripeSessionId}`

  const existing = await db.buyerRewardLedger.findUnique({ where: { idempotencyKey: key } })
  if (existing) return { ok: true }

  const user = await db.user.findUnique({
    where: { id: args.userId },
    select: { buyerRewardBalanceCents: true },
  })
  if (!user) return { ok: false, reason: "user_not_found" }
  if (user.buyerRewardBalanceCents < amount) return { ok: false, reason: "insufficient_balance" }

  await db.user.update({
    where: { id: args.userId },
    data: { buyerRewardBalanceCents: { decrement: amount } },
  })
  await db.buyerRewardLedger.create({
    data: {
      userId: args.userId,
      type: REDEEM,
      amountCents: amount,
      idempotencyKey: key,
      stripeSessionId: args.stripeSessionId,
    },
  })
  return { ok: true }
}

export async function earnBuyerRewardIdempotent(
  db: Db,
  args: {
    userId: string
    amountCents: number
    stripeSessionId: string
    affiliateProductId: string
    orderId?: string | null
  }
): Promise<void> {
  const amount = Math.max(0, Math.round(args.amountCents))
  if (amount === 0) return
  const key = `earn:${args.stripeSessionId}:${args.affiliateProductId}`

  const existing = await db.buyerRewardLedger.findUnique({ where: { idempotencyKey: key } })
  if (existing) return

  await db.user.update({
    where: { id: args.userId },
    data: { buyerRewardBalanceCents: { increment: amount } },
  })
  await db.buyerRewardLedger.create({
    data: {
      userId: args.userId,
      type: EARN,
      amountCents: amount,
      idempotencyKey: key,
      stripeSessionId: args.stripeSessionId,
      orderId: args.orderId ?? null,
    },
  })
}

/**
 * When a return is marked refunded, claw back a proportional share of the EARN entry for that order.
 * Idempotent per `orderId` (one reversal row per order).
 */
export async function reverseBuyerRewardEarnOnRefund(
  db: Db,
  args: { orderId: string; refundFraction: number }
): Promise<void> {
  const fraction = Math.max(0, Math.min(1, args.refundFraction))
  if (fraction <= 0) return

  const earn = await db.buyerRewardLedger.findFirst({
    where: { orderId: args.orderId, type: EARN },
  })
  if (!earn || earn.amountCents <= 0) return

  const clawInt = Math.min(earn.amountCents, Math.floor(earn.amountCents * fraction + 1e-9))
  if (clawInt <= 0) return

  const key = `reversal_order:${args.orderId}`
  const existing = await db.buyerRewardLedger.findUnique({ where: { idempotencyKey: key } })
  if (existing) return

  const user = await db.user.findUnique({
    where: { id: earn.userId },
    select: { buyerRewardBalanceCents: true },
  })
  const actual = Math.min(clawInt, user?.buyerRewardBalanceCents ?? 0)
  if (actual <= 0) return

  await db.user.update({
    where: { id: earn.userId },
    data: { buyerRewardBalanceCents: { decrement: actual } },
  })
  await db.buyerRewardLedger.create({
    data: {
      userId: earn.userId,
      type: REVERSAL,
      amountCents: actual,
      idempotencyKey: key,
      orderId: args.orderId,
      stripeSessionId: null,
    },
  })
}
