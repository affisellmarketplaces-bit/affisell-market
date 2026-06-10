import Stripe from "stripe"

import { AGENT_MIN_WITHDRAW_CENTS } from "@/lib/agents/agent-payout-shared"
import { assertConnectTransfersActive } from "@/lib/stripe-connect-transfer"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export type WithdrawAgentBalanceResult =
  | {
      ok: true
      amountCents: number
      ledgerEntryId: string
      stripeTransferId: string
      idempotent?: boolean
    }
  | { ok: false; error: string }

async function reverseWithdrawDebit(args: {
  agentId: string
  ledgerEntryId: string
  amountCents: number
  balanceAfterDebit: number
  reason: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.sourcingAgent.update({
      where: { id: args.agentId },
      data: { balanceCents: { increment: args.amountCents } },
    })
    await tx.agentLedgerEntry.create({
      data: {
        agentId: args.agentId,
        type: "CREDIT",
        amountCents: args.amountCents,
        balanceAfterCents: args.balanceAfterDebit + args.amountCents,
        note: `Annulation retrait — ${args.reason}`,
        idempotencyKey: `withdraw-reversal:${args.ledgerEntryId}`,
      },
    })
  })
}

/**
 * Transfer agent balance to Stripe Connect account — idempotent via idempotencyKey.
 */
export async function withdrawAgentBalance(args: {
  agentId: string
  userId: string
  idempotencyKey: string
  amountCents?: number
}): Promise<WithdrawAgentBalanceResult> {
  const idempotencyKey = args.idempotencyKey.trim()
  if (!idempotencyKey) {
    return { ok: false, error: "missing_idempotency_key" }
  }

  const existing = await prisma.agentLedgerEntry.findUnique({
    where: { idempotencyKey },
    select: { id: true, amountCents: true, stripeTransferId: true, type: true },
  })
  if (existing?.type === "DEBIT" && existing.stripeTransferId) {
    console.log("[agent-withdraw]", {
      agentId: args.agentId,
      ledgerEntryId: existing.id,
      result: "idempotent",
    })
    return {
      ok: true,
      amountCents: existing.amountCents,
      ledgerEntryId: existing.id,
      stripeTransferId: existing.stripeTransferId,
      idempotent: true,
    }
  }

  const [user, agent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: args.userId },
      select: { stripeAccountId: true, stripeOnboardedAt: true },
    }),
    prisma.sourcingAgent.findUnique({
      where: { id: args.agentId },
      select: { balanceCents: true, status: true },
    }),
  ])

  if (!agent) {
    return { ok: false, error: "agent_not_found" }
  }
  if (agent.status !== "ACTIVE") {
    return { ok: false, error: "agent_not_active" }
  }
  if (!user?.stripeAccountId || !user.stripeOnboardedAt) {
    return { ok: false, error: "connect_required" }
  }

  const amountCents = args.amountCents ?? agent.balanceCents
  if (amountCents < AGENT_MIN_WITHDRAW_CENTS) {
    return { ok: false, error: "below_minimum" }
  }
  if (amountCents > agent.balanceCents) {
    return { ok: false, error: "insufficient_balance" }
  }

  const debitResult = await prisma.$transaction(async (tx) => {
    const locked = await tx.sourcingAgent.findUnique({
      where: { id: args.agentId },
      select: { balanceCents: true },
    })
    if (!locked || locked.balanceCents < amountCents) {
      return { ok: false as const, error: "insufficient_balance" }
    }

    const nextBalance = locked.balanceCents - amountCents
    await tx.sourcingAgent.update({
      where: { id: args.agentId },
      data: { balanceCents: nextBalance },
    })
    const entry = await tx.agentLedgerEntry.create({
      data: {
        agentId: args.agentId,
        type: "DEBIT",
        amountCents,
        balanceAfterCents: nextBalance,
        note: "Retrait Stripe Connect",
        idempotencyKey,
      },
      select: { id: true },
    })
    return { ok: true as const, ledgerEntryId: entry.id, balanceAfterDebit: nextBalance }
  })

  if (!debitResult.ok) {
    return debitResult
  }

  const stripe = getStripeClient()
  try {
    await assertConnectTransfersActive(user.stripeAccountId)
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: "eur",
        destination: user.stripeAccountId,
        metadata: {
          agentId: args.agentId,
          ledgerEntryId: debitResult.ledgerEntryId,
          role: "agent",
        },
      },
      { idempotencyKey: `agent_withdraw_${debitResult.ledgerEntryId}` }
    )

    await prisma.agentLedgerEntry.update({
      where: { id: debitResult.ledgerEntryId },
      data: { stripeTransferId: transfer.id },
    })

    console.log("[agent-withdraw]", {
      agentId: args.agentId,
      amountCents,
      ledgerEntryId: debitResult.ledgerEntryId,
      stripeTransferId: transfer.id,
      result: "transferred",
    })

    return {
      ok: true,
      amountCents,
      ledgerEntryId: debitResult.ledgerEntryId,
      stripeTransferId: transfer.id,
    }
  } catch (error) {
    const reason =
      error instanceof Stripe.errors.StripeError ? error.code ?? error.message : "stripe_error"
    await reverseWithdrawDebit({
      agentId: args.agentId,
      ledgerEntryId: debitResult.ledgerEntryId,
      amountCents,
      balanceAfterDebit: debitResult.balanceAfterDebit,
      reason,
    })
    console.error("[agent-withdraw]", {
      agentId: args.agentId,
      ledgerEntryId: debitResult.ledgerEntryId,
      error: reason,
      result: "reversed",
    })
    return { ok: false, error: "stripe_transfer_failed" }
  }
}
