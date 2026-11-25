import Stripe from "stripe"

import { AGENT_MIN_WITHDRAW_CENTS } from "@/lib/agents/agent-payout-shared"
import { assertConnectTransfersActive } from "@/lib/stripe-connect-transfer"
import { prisma } from "@/lib/prisma"
import { agentWithdrawalLegKey, isLegPaid, legProvablyUnpaid } from "@/lib/payouts/leg-model"
import { executeLegTransfer } from "@/lib/payouts/leg-transfer.server"

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
 * Pays one withdrawal (= one agent ledger DEBIT) through the payout leg registry. The debit is given back ONLY when the
 * registry proves nothing was created (refused by Stripe, not processed, invalid, registry unreachable before Stripe):
 * a timeout or a network error leaves the leg IN_DOUBT and the debit in place — giving the balance back while the
 * transfer may exist would let the agent withdraw the same money twice.
 */
async function payWithdrawalLeg(args: {
  agentId: string
  ledgerEntryId: string
  amountCents: number
  destination: string
  balanceAfterDebit: number
}): Promise<WithdrawAgentBalanceResult> {
  const leg = await executeLegTransfer({
    legKey: agentWithdrawalLegKey(args.ledgerEntryId),
    kind: "agent_withdrawal",
    role: "AGENT",
    rail: "agent_withdrawal",
    orderId: null,
    transferGroup: `agent_withdrawal_${args.ledgerEntryId}`,
    params: { amountCents: args.amountCents, currency: "eur", destination: args.destination, sourceTransaction: null },
    extraMetadata: { agentId: args.agentId, ledgerEntryId: args.ledgerEntryId, role: "agent" },
  })

  if (isLegPaid(leg)) {
    await prisma.agentLedgerEntry.updateMany({
      where: { id: args.ledgerEntryId, stripeTransferId: null },
      data: { stripeTransferId: leg.stripeTransferId },
    })
    console.log("[agent-withdraw]", {
      agentId: args.agentId,
      ledgerEntryId: args.ledgerEntryId,
      stripeTransferId: leg.stripeTransferId,
      result: "transferred",
    })
    return {
      ok: true,
      amountCents: args.amountCents,
      ledgerEntryId: args.ledgerEntryId,
      stripeTransferId: leg.stripeTransferId,
    }
  }

  if (legProvablyUnpaid(leg)) {
    await reverseWithdrawDebit({
      agentId: args.agentId,
      ledgerEntryId: args.ledgerEntryId,
      amountCents: args.amountCents,
      balanceAfterDebit: args.balanceAfterDebit,
      reason: leg.outcome,
    })
    console.error("[agent-withdraw]", {
      agentId: args.agentId,
      ledgerEntryId: args.ledgerEntryId,
      error: leg.outcome,
      result: "reversed",
    })
    return { ok: false, error: "stripe_transfer_failed" }
  }

  console.error("[agent-withdraw]", {
    agentId: args.agentId,
    ledgerEntryId: args.ledgerEntryId,
    outcome: leg.outcome,
    result: "in_doubt_debit_kept",
  })
  return { ok: false, error: "transfer_in_doubt" }
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
    select: { id: true, amountCents: true, stripeTransferId: true, type: true, balanceAfterCents: true },
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

  if (existing?.type === "DEBIT" && !existing.stripeTransferId) {
    // The same withdrawal was debited earlier but its transfer is not recorded (in doubt, or interrupted): ask the
    // registry again for THAT leg — it answers paid once reconciled, in doubt otherwise. Never a second debit.
    const owner = await prisma.user.findUnique({ where: { id: args.userId }, select: { stripeAccountId: true } })
    if (!owner?.stripeAccountId) return { ok: false, error: "connect_required" }
    return payWithdrawalLeg({
      agentId: args.agentId,
      ledgerEntryId: existing.id,
      amountCents: existing.amountCents,
      destination: owner.stripeAccountId,
      balanceAfterDebit: existing.balanceAfterCents,
    })
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

  try {
    await assertConnectTransfersActive(user.stripeAccountId)
  } catch (error) {
    // Checked before any transfer: nothing was created, the debit is given back.
    const reason =
      error instanceof Stripe.errors.StripeError ? error.code ?? error.message : "connect_not_active"
    await reverseWithdrawDebit({
      agentId: args.agentId,
      ledgerEntryId: debitResult.ledgerEntryId,
      amountCents,
      balanceAfterDebit: debitResult.balanceAfterDebit,
      reason,
    })
    return { ok: false, error: "stripe_transfer_failed" }
  }

  return payWithdrawalLeg({
    agentId: args.agentId,
    ledgerEntryId: debitResult.ledgerEntryId,
    amountCents,
    destination: user.stripeAccountId,
    balanceAfterDebit: debitResult.balanceAfterDebit,
  })
}
