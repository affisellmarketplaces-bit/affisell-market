import type Stripe from "stripe"

import {
  disputeReconcileMode,
  planDisputeReconciliation,
  type DisputeReconcileDecision,
  type DisputeReconcileMode,
  type StripeDisputeLite,
} from "@/lib/finance/dispute-reconcile"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export type DisputeReconcileResult = {
  mode: DisputeReconcileMode
  sinceDays: number
  disputesSeen: number
  decisions: DisputeReconcileDecision[]
  replayed: Array<{ disputeId: string; status: string; error: string | null }>
}

const chargeIdOf = (c: string | Stripe.Charge | null | undefined) => (typeof c === "string" ? c : (c?.id ?? null))

/**
 * Lists Stripe's disputes created in the last `sinceDays` (all pages), plans against the D7 ledger and — only in
 * `apply` mode — replays each planned dispute through `processStripeDisputeEvent` in its own transaction, exactly as
 * the webhook does (same handler, same 25 s budget). `report` (default) and `off` write nothing.
 */
export async function reconcileStripeDisputes(opts: { sinceDays?: number; mode?: DisputeReconcileMode } = {}) {
  const mode = opts.mode ?? disputeReconcileMode(process.env.DISPUTE_RECONCILE_MODE)
  const sinceDays = Math.min(Math.max(Math.round(opts.sinceDays ?? 120), 1), 180)
  const result: DisputeReconcileResult = { mode, sinceDays, disputesSeen: 0, decisions: [], replayed: [] }
  if (mode === "off") return result

  const stripe = getStripeClient()
  const gte = Math.floor(Date.now() / 1000) - sinceDays * 86_400
  const disputes: StripeDisputeLite[] = []
  for await (const d of stripe.disputes.list({ created: { gte }, limit: 100 })) {
    disputes.push({ id: d.id, status: d.status, charge: chargeIdOf(d.charge) })
  }
  result.disputesSeen = disputes.length
  if (disputes.length === 0) return result

  const charges = [...new Set(disputes.map((d) => d.charge).filter((c): c is string => Boolean(c)))]
  const orders = await prisma.order.findMany({
    where: { stripeChargeId: { in: charges } },
    select: { stripeChargeId: true },
  })
  const chargesWithOrder = new Set(orders.map((o) => o.stripeChargeId).filter((c): c is string => Boolean(c)))

  const holdRows = await prisma.processedWebhook.findMany({
    where: { OR: disputes.map((d) => ({ id: { startsWith: `dispute:${d.id}:` } })) },
    select: { id: true, status: true },
  })
  const holdsByDispute = new Map<string, string[]>()
  for (const row of holdRows) {
    const disputeId = row.id.split(":")[1] ?? ""
    holdsByDispute.set(disputeId, [...(holdsByDispute.get(disputeId) ?? []), row.status])
  }

  result.decisions = planDisputeReconciliation(disputes, chargesWithOrder, holdsByDispute)
  if (mode !== "apply") return result

  const { processStripeDisputeEvent } = await import("@/lib/stripe-dispute")
  for (const decision of result.decisions) {
    if (decision.action !== "replay") continue
    const dispute = disputes.find((d) => d.id === decision.disputeId)!
    // A synthetic event: the handler reads the LIVE dispute anyway and decides under its row lock (idempotent).
    const event = {
      id: `reconcile_${dispute.id}`,
      type: "charge.dispute.updated",
      data: { object: { id: dispute.id, status: dispute.status, charge: dispute.charge } },
    } as unknown as Stripe.Event
    try {
      const outcome = await prisma.$transaction((tx) => processStripeDisputeEvent(event, tx), { timeout: 25_000 })
      result.replayed.push({ disputeId: dispute.id, status: outcome.status, error: outcome.error })
    } catch (err) {
      result.replayed.push({
        disputeId: dispute.id,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return result
}
