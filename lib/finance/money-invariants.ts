import { orderChargedTotalCents } from "@/lib/money/split-guard"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { payableAfterRefunds } from "@/lib/transfers/payable-after-refunds"

/**
 * Money invariants — what the payout rules of #13 / #26 / #28 promise, checked against what the database says really
 * happened. Pure: one order snapshot in, the violations out. The loader (`money-invariants.server.ts`) reads the rows in
 * a server-enforced READ-ONLY session; the report (`npm run report:money-invariants`) prints them.
 *
 * "Moved" = ledger rows on a real rail (`connect`, `lightning`): PAYOUT minus every CLAWBACK (except `phantom_legacy`
 * audit rows). `ledger_only` rows are internal obligations, not money that left Stripe.
 *
 * It detects; it never repairs. A violation is a question for a person, with the numbers to answer it.
 */

export type MoneyRole = "SUPPLIER" | "AFFILIATE"
export const MONEY_ROLES: readonly MoneyRole[] = ["SUPPLIER", "AFFILIATE"]

export type OrderMoneySnapshot = {
  orderId: string
  status: string | null
  paymentSettlementStatus: string | null
  payoutStatus: string | null
  totalCents: number | null
  subtotalCents: number | null
  taxCents: number | null
  sellingPriceCents: number
  refunds: ReadonlyArray<{ amountCents: number }>
  attempts: ReadonlyArray<{
    role: string
    amountCents: number
    status: string
    stripeTransferId: string | null
  }>
  ledger: ReadonlyArray<{
    beneficiaryRole: string
    entryType: string
    amountCents: number
    stripeTransferId: string | null
    payoutRail: string | null
    createdAt: Date
  }>
  /** Dispute hold rows of the D7 ledger (`ProcessedWebhook` ids `dispute:<dp>:<order>`). */
  disputes: ReadonlyArray<{ status: string; createdAt: Date }>
}

export type MoneyInvariantCode =
  | "refunds_exceed_charge"
  | "paid_more_than_payable"
  | "several_transfers_one_role"
  | "paid_on_two_rails"
  | "paid_after_dispute_opened"
  | "success_without_ledger"
  | "ledger_transfer_without_success"
  | "paid_on_closed_order"
  | "pending_attempt_on_closed_order"

export type MoneyInvariantSeverity = "critical" | "high" | "medium" | "low"

export const MONEY_INVARIANT_SEVERITY: Record<MoneyInvariantCode, MoneyInvariantSeverity> = {
  refunds_exceed_charge: "critical",
  paid_more_than_payable: "critical",
  several_transfers_one_role: "critical",
  paid_on_two_rails: "critical",
  paid_after_dispute_opened: "high",
  success_without_ledger: "high",
  ledger_transfer_without_success: "medium",
  paid_on_closed_order: "medium",
  pending_attempt_on_closed_order: "low",
}

export type MoneyInvariantViolation = {
  orderId: string
  code: MoneyInvariantCode
  severity: MoneyInvariantSeverity
  role?: MoneyRole
  expectedCents?: number
  actualCents?: number
  detail: string
}

const TOLERANCE_CENTS = 1
const REAL_RAILS = new Set(["connect", "lightning"])
const OPEN_OR_LOST = new Set(["dispute_open", "dispute_lost"])

function movedCents(snapshot: OrderMoneySnapshot, role: MoneyRole): number {
  let net = 0
  for (const row of snapshot.ledger) {
    if (row.beneficiaryRole !== role || row.payoutRail === "phantom_legacy") continue
    if (row.entryType === "CLAWBACK") net -= row.amountCents
    else if (row.entryType === "PAYOUT" && REAL_RAILS.has(row.payoutRail ?? "")) net += row.amountCents
  }
  return net
}

function payoutRows(snapshot: OrderMoneySnapshot, role: MoneyRole) {
  return snapshot.ledger.filter(
    (r) => r.beneficiaryRole === role && r.entryType === "PAYOUT" && REAL_RAILS.has(r.payoutRail ?? ""),
  )
}

export function evaluateOrderMoneyInvariants(snapshot: OrderMoneySnapshot): MoneyInvariantViolation[] {
  const out: MoneyInvariantViolation[] = []
  const add = (v: Omit<MoneyInvariantViolation, "orderId" | "severity">) =>
    out.push({ orderId: snapshot.orderId, severity: MONEY_INVARIANT_SEVERITY[v.code], ...v })

  const charged = orderChargedTotalCents(snapshot)
  const refundCents = snapshot.refunds.map((r) => Math.max(0, r.amountCents))
  const refunded = refundCents.reduce((s, c) => s + c, 0)
  if (charged > 0 && refunded > charged + TOLERANCE_CENTS) {
    add({
      code: "refunds_exceed_charge",
      expectedCents: charged,
      actualCents: refunded,
      detail: "refunded more than charged",
    })
  }

  const closed = isOrderClosedForPayout(snapshot)
  const firstDisputeAt = snapshot.disputes
    .filter((d) => OPEN_OR_LOST.has(d.status))
    .reduce<Date | null>((min, d) => (min === null || d.createdAt < min ? d.createdAt : min), null)

  for (const role of MONEY_ROLES) {
    const attempt = snapshot.attempts.find((a) => a.role === role)
    const moved = movedCents(snapshot, role)
    const payouts = payoutRows(snapshot, role)

    if (attempt) {
      const { payableCents } = payableAfterRefunds({
        scheduledCents: attempt.amountCents,
        refundCents,
        orderChargedTotalCents: charged,
      })
      if (moved > payableCents + TOLERANCE_CENTS) {
        add({
          code: "paid_more_than_payable",
          role,
          expectedCents: payableCents,
          actualCents: moved,
          detail: `net moved ${moved} > payableAfterRefunds ${payableCents} (scheduled ${attempt.amountCents}, refunds ${refunded})`,
        })
      }
      if (attempt.status === "SUCCESS" && attempt.stripeTransferId) {
        if (!snapshot.ledger.some((r) => r.stripeTransferId === attempt.stripeTransferId)) {
          add({
            code: "success_without_ledger",
            role,
            detail: `attempt SUCCESS ${attempt.stripeTransferId} has no ledger row`,
          })
        }
      }
      if (attempt.status === "PENDING" && closed) {
        add({
          code: "pending_attempt_on_closed_order",
          role,
          detail: "PENDING attempt on a closed order (not superseded yet)",
        })
      }
    }

    const transferIds = new Set(payouts.map((r) => r.stripeTransferId).filter((id): id is string => Boolean(id)))
    if (transferIds.size > 1) {
      add({
        code: "several_transfers_one_role",
        role,
        actualCents: payouts.reduce((s, r) => s + r.amountCents, 0),
        detail: `${transferIds.size} distinct transfers for one role: ${[...transferIds].join(", ")}`,
      })
    }

    const rails = new Set(payouts.map((r) => r.payoutRail))
    if (rails.has("connect") && rails.has("lightning")) {
      add({ code: "paid_on_two_rails", role, actualCents: moved, detail: "paid by Lightning AND by Connect" })
    }

    if (firstDisputeAt && payouts.some((r) => r.createdAt > firstDisputeAt)) {
      add({
        code: "paid_after_dispute_opened",
        role,
        actualCents: moved,
        detail: "a payout was recorded after the dispute hold",
      })
    }

    for (const row of payouts) {
      if (row.payoutRail !== "connect" || !row.stripeTransferId) continue
      const matched = snapshot.attempts.some(
        (a) => a.role === role && a.status === "SUCCESS" && a.stripeTransferId === row.stripeTransferId,
      )
      if (!matched) {
        add({
          code: "ledger_transfer_without_success",
          role,
          detail: `ledger transfer ${row.stripeTransferId} has no SUCCESS attempt`,
        })
      }
    }

    if (closed && moved > 0 && refundCents.length === 0) {
      add({
        code: "paid_on_closed_order",
        role,
        actualCents: moved,
        detail: "money moved on a closed order with no refund recorded",
      })
    }
  }
  return out
}

export type MoneyInvariantSummary = {
  ordersChecked: number
  violations: number
  bySeverity: Record<MoneyInvariantSeverity, number>
  byCode: Partial<Record<MoneyInvariantCode, number>>
}

export function summarizeMoneyInvariants(ordersChecked: number, violations: readonly MoneyInvariantViolation[]) {
  const bySeverity: Record<MoneyInvariantSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const byCode: Partial<Record<MoneyInvariantCode, number>> = {}
  for (const v of violations) {
    bySeverity[v.severity] += 1
    byCode[v.code] = (byCode[v.code] ?? 0) + 1
  }
  return { ordersChecked, violations: violations.length, bySeverity, byCode } satisfies MoneyInvariantSummary
}

/** 0 clean · 1 medium/low only · 2 at least one critical or high. */
export function moneyInvariantsExitCode(summary: MoneyInvariantSummary): 0 | 1 | 2 {
  if (summary.bySeverity.critical + summary.bySeverity.high > 0) return 2
  return summary.violations > 0 ? 1 : 0
}
