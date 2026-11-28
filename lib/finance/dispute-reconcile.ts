import { disputeOutcomeFromStripeStatus, type DisputeOutcome } from "@/lib/orders/dispute-state"

/**
 * Dispute reconciliation — the safety net for a lost webhook. D7 (#28) reacts to `charge.dispute.*` events; if Stripe
 * gave up delivering one (≈3 days of retries) after the transfer left, the dispute was never recorded: no hold, no
 * clawback when lost. This compares Stripe's disputes with the D7 ledger (`ProcessedWebhook` `dispute:<dp>:<order>`)
 * and decides which ones to REPLAY through the very same idempotent handler (`processStripeDisputeEvent`, which reads
 * the live dispute and decides under `lockDisputeHold`). Pure.
 */

const HOLD_FOR_OUTCOME: Record<DisputeOutcome, string> = {
  open: "dispute_open",
  won: "dispute_won",
  lost: "dispute_lost",
  closed: "dispute_closed",
}
const TERMINAL_HOLDS = new Set(["dispute_won", "dispute_lost", "dispute_closed"])

export type StripeDisputeLite = { id: string; status: string; charge: string | null }

export type DisputeReconcileDecision =
  | { disputeId: string; action: "replay"; reason: "missing_hold" | "outcome_not_applied"; expectedHold: string }
  | { disputeId: string; action: "report"; reason: "terminal_conflict"; expectedHold: string; holds: string[] }

/**
 * @param disputes Stripe's disputes in the window.
 * @param chargesWithOrder charges that belong to a marketplace order (`Order.stripeChargeId`); other disputes are not ours.
 * @param holdsByDispute D7 hold statuses already recorded, per dispute id (one row per order of the charge).
 */
export function planDisputeReconciliation(
  disputes: readonly StripeDisputeLite[],
  chargesWithOrder: ReadonlySet<string>,
  holdsByDispute: ReadonlyMap<string, readonly string[]>,
): DisputeReconcileDecision[] {
  const out: DisputeReconcileDecision[] = []
  for (const d of disputes) {
    if (!d.charge || !chargesWithOrder.has(d.charge)) continue
    const expectedHold = HOLD_FOR_OUTCOME[disputeOutcomeFromStripeStatus(d.status)]
    const holds = holdsByDispute.get(d.id) ?? []
    if (holds.length === 0) {
      out.push({ disputeId: d.id, action: "replay", reason: "missing_hold", expectedHold })
      continue
    }
    if (holds.every((h) => h === expectedHold)) continue
    if (expectedHold !== "dispute_open" && holds.some((h) => h === "dispute_open")) {
      out.push({ disputeId: d.id, action: "replay", reason: "outcome_not_applied", expectedHold })
      continue
    }
    // A terminal hold is never rewritten by D7: a mismatch is for a person, never replayed in a loop.
    if (holds.some((h) => TERMINAL_HOLDS.has(h) && h !== expectedHold)) {
      out.push({ disputeId: d.id, action: "report", reason: "terminal_conflict", expectedHold, holds: [...holds] })
    }
  }
  return out
}

export type DisputeReconcileMode = "off" | "report" | "apply"

/** `DISPUTE_RECONCILE_MODE` = off | report (DEFAULT, no write) | apply — exactly those words, anything else = report. */
export function disputeReconcileMode(raw: string | undefined): DisputeReconcileMode {
  if (raw === "off" || raw === "apply") return raw
  return "report"
}
