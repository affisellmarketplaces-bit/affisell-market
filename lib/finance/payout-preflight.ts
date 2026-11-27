import type { DisputeReconcileDecision } from "@/lib/finance/dispute-reconcile"
import type { MoneyInvariantSummary, MoneyInvariantViolation } from "@/lib/finance/money-invariants"
import type { TransferDuplicate } from "@/lib/finance/stripe-transfer-duplicates"
import type { SubscriptionCheck } from "@/lib/stripe-webhook-required-events"

/**
 * Payout preflight — ONE verdict before a payout cycle: PASS · WARNING · BLOCKED. Pure: it judges what the gatherer
 * (`payout-preflight.server.ts`) read; it never moves money and is not wired to any transfer path yet.
 *
 * Rule of the verdict: the worst check wins. A check that could not run (missing key, database unreachable, Stripe
 * error) is BLOCKED — "no data" never reads as "no problem".
 */
export type PreflightStatus = "PASS" | "WARNING" | "BLOCKED"
export type PreflightCheckId =
  | "stripe_key_mode"
  | "webhook_subscription"
  | "ledger_invariants"
  | "stripe_duplicates"
  | "stripe_ledger_consistency"
  | "stripe_refunds_recorded"
  | "dispute_holds"
  | "webhook_freshness"

/** Every check must be present for a PASS: a result missing one (a future refactor, a skipped gatherer) is BLOCKED. */
export const REQUIRED_PREFLIGHT_CHECKS: readonly PreflightCheckId[] = [
  "stripe_key_mode",
  "webhook_subscription",
  "ledger_invariants",
  "stripe_duplicates",
  "stripe_ledger_consistency",
  "stripe_refunds_recorded",
  "dispute_holds",
  "webhook_freshness",
]

export type PreflightCheck = {
  id: PreflightCheckId
  status: PreflightStatus
  summary: string
  evidence: string[]
  recommendation: string | null
}

export type PreflightInput = {
  keyMode: "test" | "live" | "unknown" | null
  /** null = the check could not run (with `errors.webhooks`). */
  webhooks: SubscriptionCheck[] | null
  invariants: { summary: MoneyInvariantSummary; violations: MoneyInvariantViolation[] } | null
  duplicates: TransferDuplicate[] | null
  /** Stripe transfers in the window that belong to one of OUR orders (transfer_group = order id). */
  consistency: {
    orderTransfers: number
    /** Stripe transfers of our orders that neither the ledger nor a TransferAttempt records. */
    unrecorded: Array<{ transferId: string; transferGroup: string; amount: number }>
    /** Recorded, but the amount or the destination Stripe holds differs from what we recorded. */
    mismatches?: Array<{ transferId: string; kind: "amount" | "destination"; stripe: string; recorded: string }>
    /** Destination is no Connect account of ours (no user, no fulfilment provider). */
    unknownDestinations?: Array<{ transferId: string; destination: string }>
    /** Reversed at Stripe (fully or partly) without a CLAWBACK row of that amount. */
    reversalsUnrecorded?: Array<{ transferId: string; reversedCents: number; clawedBackCents: number }>
  } | null
  /** Stripe refunds on charges of our orders vs OrderStripeRefund rows (a missed charge.refunded webhook). */
  refunds: { checked: number; unrecorded: Array<{ refundId: string; orderId: string; amount: number }> } | null
  /** Stripe disputes on our charges vs the D7 holds (a missed charge.dispute.* webhook). */
  disputes: { seen: number; decisions: DisputeReconcileDecision[] } | null
  /** Are webhooks still arriving? Latest Stripe charge vs latest processed webhook. */
  freshness: { latestChargeAt: string | null; latestWebhookAt: string | null } | null
  errors?: Partial<
    Record<"webhooks" | "invariants" | "duplicates" | "consistency" | "refunds" | "disputes" | "freshness", string>
  >
}

export type PreflightResult = {
  verdict: PreflightStatus
  checks: PreflightCheck[]
  /** When the data was read — a gate refuses a result older than its max age. */
  generatedAt: string
}

/** A webhook older than the latest charge by more than this = webhooks are not arriving. */
export const WEBHOOK_FRESHNESS_TOLERANCE_MS = 60 * 60 * 1000

const RANK: Record<PreflightStatus, number> = { PASS: 0, WARNING: 1, BLOCKED: 2 }
const worst = (a: PreflightStatus, b: PreflightStatus) => (RANK[b] > RANK[a] ? b : a)
const notRun = (id: PreflightCheckId, what: string, err?: string): PreflightCheck => ({
  id,
  status: "BLOCKED",
  summary: `${what} could not be checked`,
  evidence: err ? [err] : [],
  recommendation: "Fix the access or the error and run the preflight again; no payout cycle until this check runs.",
})

export function evaluatePayoutPreflight(input: PreflightInput, now: Date = new Date()): PreflightResult {
  const checks: PreflightCheck[] = []

  // 1. Which Stripe mode the checks ran against — reported, and "unknown" blocks.
  checks.push(
    input.keyMode === "test" || input.keyMode === "live"
      ? {
          id: "stripe_key_mode",
          status: "PASS",
          summary: `Stripe ${input.keyMode === "live" ? "LIVE" : "Test"} mode`,
          evidence: [],
          recommendation: null,
        }
      : notRun("stripe_key_mode", "The Stripe key mode", "key missing or not a sk_/rk_ test or live key"),
  )

  // 2. Webhook subscription: money events must reach the platform.
  if (!input.webhooks) checks.push(notRun("webhook_subscription", "The webhook subscription", input.errors?.webhooks))
  else {
    const enabled = input.webhooks.filter((w) => w.enabled)
    const critical = enabled.filter((w) => w.missingMoneyCritical.length > 0)
    const other = enabled.filter((w) => w.missing.length > 0 && w.missingMoneyCritical.length === 0)
    if (enabled.length === 0) {
      checks.push({
        id: "webhook_subscription",
        status: "BLOCKED",
        summary: "No enabled webhook endpoint for the platform",
        evidence: input.webhooks.map((w) => `${w.endpoint} (disabled)`),
        recommendation: "Enable the platform endpoint with the required events (npm run verify:stripe-webhooks).",
      })
    } else if (critical.length > 0) {
      checks.push({
        id: "webhook_subscription",
        status: "BLOCKED",
        summary: "Refund / dispute / payment events do not reach the platform",
        evidence: critical.map((w) => `${w.endpoint}: missing ${w.missingMoneyCritical.join(", ")}`),
        recommendation: "Subscribe the endpoint to the missing events before any payout cycle.",
      })
    } else {
      checks.push({
        id: "webhook_subscription",
        status: other.length > 0 ? "WARNING" : "PASS",
        summary: other.length > 0 ? "Non-money events are missing" : "Every required event is subscribed",
        evidence: other.map((w) => `${w.endpoint}: missing ${w.missing.join(", ")}`),
        recommendation: other.length > 0 ? "Add the missing events (accounts, checkout expiry, subscriptions)." : null,
      })
    }
  }

  // 3. Ledger invariants (#13 / #26 / #28 rules on what the database recorded).
  if (!input.invariants) checks.push(notRun("ledger_invariants", "The ledger invariants", input.errors?.invariants))
  else {
    const { summary, violations } = input.invariants
    const blocking = summary.bySeverity.critical + summary.bySeverity.high
    const top = [...violations].sort((a, b) => sevRank(b.severity) - sevRank(a.severity)).slice(0, 10)
    checks.push({
      id: "ledger_invariants",
      status: blocking > 0 ? "BLOCKED" : summary.violations > 0 || summary.ordersChecked === 0 ? "WARNING" : "PASS",
      summary:
        summary.ordersChecked === 0
          ? "No order with money activity in the window (nothing was checked)"
          : `${summary.ordersChecked} orders checked, ${summary.violations} violations ${JSON.stringify(summary.bySeverity)}`,
      evidence: top.map((v) => `[${v.severity}] ${v.code} ${v.orderId}${v.role ? ` ${v.role}` : ""} — ${v.detail}`),
      recommendation:
        blocking > 0
          ? "Resolve every critical/high violation (npm run report:money-invariants -- --json) before paying."
          : summary.violations > 0
            ? "Review the medium/low items."
            : null,
    })
  }

  // 4. Stripe-side duplicates: a beneficiary paid more than once for one order.
  if (!input.duplicates)
    checks.push(notRun("stripe_duplicates", "Stripe duplicate transfers", input.errors?.duplicates))
  else {
    const extra = input.duplicates.reduce((s, d) => s + d.extraCents, 0)
    checks.push({
      id: "stripe_duplicates",
      status: input.duplicates.length > 0 ? "BLOCKED" : "PASS",
      summary:
        input.duplicates.length > 0
          ? `${input.duplicates.length} beneficiaries paid more than once — ${(extra / 100).toFixed(2)} extra`
          : "No beneficiary paid twice for one order",
      evidence: input.duplicates
        .slice(0, 10)
        .map((d) => `${d.transferGroup} → ${d.destination} ${d.role ?? "?"}: ${d.transferIds.join(", ")}`),
      recommendation:
        input.duplicates.length > 0
          ? "Decide each case by hand (reversal or accepted loss); payouts of these legs stay held (EXISTING_TRANSFERS_SEVERAL)."
          : null,
    })
  }

  // 5. Stripe ↔ ledger: money Stripe moved for our orders that we did not record, or recorded differently.
  if (!input.consistency) {
    checks.push(notRun("stripe_ledger_consistency", "Stripe ↔ ledger consistency", input.errors?.consistency))
  } else {
    const { unrecorded, orderTransfers } = input.consistency
    const mismatches = input.consistency.mismatches ?? []
    const unknown = input.consistency.unknownDestinations ?? []
    const reversals = input.consistency.reversalsUnrecorded ?? []
    const blocking = unrecorded.length + mismatches.length + unknown.length
    checks.push({
      id: "stripe_ledger_consistency",
      status: blocking > 0 ? "BLOCKED" : reversals.length > 0 ? "WARNING" : "PASS",
      summary:
        blocking + reversals.length > 0
          ? `${orderTransfers} Stripe transfers of our orders: ${unrecorded.length} unrecorded, ${mismatches.length} amount/destination mismatches, ${unknown.length} to an unknown account, ${reversals.length} reversals not clawed back`
          : `${orderTransfers} Stripe transfers of our orders, all recorded with the same amount and destination`,
      evidence: [
        ...unrecorded.map((u) => `unrecorded ${u.transferId} (${u.transferGroup}, ${u.amount})`),
        ...mismatches.map((m) => `${m.kind} mismatch ${m.transferId}: Stripe ${m.stripe} ≠ recorded ${m.recorded}`),
        ...unknown.map((u) => `unknown destination ${u.transferId} → ${u.destination}`),
        ...reversals.map(
          (r) => `reversal ${r.transferId}: ${r.reversedCents} reversed, ${r.clawedBackCents} clawed back`,
        ),
      ].slice(0, 15),
      recommendation:
        blocking > 0
          ? "Explain every transfer Stripe holds that the ledger does not match before paying; the invariants only see the ledger."
          : reversals.length > 0
            ? "Record the reversals as CLAWBACK rows (or explain them)."
            : null,
    })
  }

  // 6. Refunds Stripe made that the platform never recorded (missed charge.refunded): payable would be overstated.
  if (!input.refunds) checks.push(notRun("stripe_refunds_recorded", "Stripe refunds", input.errors?.refunds))
  else {
    const { unrecorded, checked } = input.refunds
    checks.push({
      id: "stripe_refunds_recorded",
      status: unrecorded.length > 0 ? "BLOCKED" : "PASS",
      summary:
        unrecorded.length > 0
          ? `${unrecorded.length} of ${checked} Stripe refunds on our orders are not recorded — what is payable is overstated`
          : `${checked} Stripe refunds on our orders, all recorded`,
      evidence: unrecorded.slice(0, 10).map((r) => `${r.refundId} (${r.orderId}, ${r.amount})`),
      recommendation:
        unrecorded.length > 0
          ? "Replay charge.refunded for these charges (or subscribe the endpoint to it) before paying the orders."
          : null,
    })
  }

  // 7. Disputes Stripe holds that have no D7 hold (missed charge.dispute.*): their payouts would not be frozen.
  if (!input.disputes) checks.push(notRun("dispute_holds", "Dispute holds", input.errors?.disputes))
  else {
    const { decisions, seen } = input.disputes
    checks.push({
      id: "dispute_holds",
      status: decisions.length > 0 ? "BLOCKED" : "PASS",
      summary:
        decisions.length > 0
          ? `${decisions.length} of ${seen} Stripe disputes on our charges are not reflected by the holds`
          : `${seen} Stripe disputes on our charges, all reflected by the holds`,
      evidence: decisions.slice(0, 10).map((d) => `${d.disputeId}: ${d.reason} (expected ${d.expectedHold})`),
      recommendation:
        decisions.length > 0
          ? "Run the dispute reconciliation (GET /api/cron/reconcile-disputes, mode report/apply)."
          : null,
    })
  }

  // 8. Are webhooks arriving? A charge newer than the latest processed webhook by more than the tolerance means the
  // refund / dispute events of recent orders may never have been processed.
  if (!input.freshness) checks.push(notRun("webhook_freshness", "Webhook freshness", input.errors?.freshness))
  else {
    const charge = input.freshness.latestChargeAt ? Date.parse(input.freshness.latestChargeAt) : null
    const hook = input.freshness.latestWebhookAt ? Date.parse(input.freshness.latestWebhookAt) : null
    const late = charge !== null && (hook === null || charge - hook > WEBHOOK_FRESHNESS_TOLERANCE_MS)
    checks.push({
      id: "webhook_freshness",
      status: late ? "BLOCKED" : "PASS",
      summary: late
        ? "Stripe has charges newer than the last processed webhook: webhooks are not arriving"
        : charge === null
          ? "No charge in the window"
          : "Webhooks are arriving",
      evidence: [
        `latest charge ${input.freshness.latestChargeAt ?? "none"}`,
        `latest webhook ${input.freshness.latestWebhookAt ?? "none"}`,
      ],
      recommendation: late
        ? "Check the endpoint (URL, signing secret, deliveries in the Stripe dashboard) before paying."
        : null,
    })
  }

  return finalizePreflight(checks, now)
}

/** Verdict = worst check; a result missing a required check (or with a duplicate id) is BLOCKED. Exported for tests. */
export function finalizePreflight(checks: PreflightCheck[], now: Date): PreflightResult {
  // Completeness: a PASS needs every required check (and no duplicate id).
  const ids = checks.map((c) => c.id)
  const missing = REQUIRED_PREFLIGHT_CHECKS.filter((id) => !ids.includes(id))
  if (missing.length > 0 || new Set(ids).size !== ids.length) {
    checks.push({
      id: "stripe_key_mode",
      status: "BLOCKED",
      summary: "The preflight result is incomplete",
      evidence: missing.map((m) => `missing check ${m}`),
      recommendation: "A preflight that did not run every check cannot authorise a payout cycle.",
    })
  }

  return {
    verdict: checks.reduce<PreflightStatus>((v, c) => worst(v, c.status), "PASS"),
    checks,
    generatedAt: now.toISOString(),
  }
}

function sevRank(s: MoneyInvariantViolation["severity"]): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s]
}

/** 0 PASS · 1 WARNING · 2 BLOCKED (for CI / a future gate). */
export function preflightExitCode(r: PreflightResult): 0 | 1 | 2 {
  return r.verdict === "PASS" ? 0 : r.verdict === "WARNING" ? 1 : 2
}

export class PayoutPreflightBlockedError extends Error {
  constructor(readonly result: PreflightResult) {
    super(
      `payout preflight ${result.verdict}: ${result.checks
        .filter((c) => c.status !== "PASS")
        .map((c) => c.id)
        .join(", ")}`,
    )
  }
}

/** A preflight result older than this cannot authorise a payout cycle (the data moved since). */
export const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000

/**
 * The future gate (NOT wired anywhere): a payout cycle would call this with a fresh result and stop on BLOCKED, on a
 * missing or malformed result, or on a result older than `maxAgeMs`. WARNING lets the cycle run (and is logged).
 * Kept here so the contract is tested before it is used.
 */
export function assertPayoutPreflightAllows(
  result: PreflightResult | null | undefined,
  opts: { now?: Date; maxAgeMs?: number } = {},
): void {
  const blocked = (summary: string): PreflightResult => ({
    verdict: "BLOCKED",
    generatedAt: new Date(0).toISOString(),
    checks: [{ id: "stripe_key_mode", status: "BLOCKED", summary, evidence: [], recommendation: "Run the preflight." }],
  })
  if (!result || !Array.isArray(result.checks)) throw new PayoutPreflightBlockedError(blocked("no preflight result"))
  const at = Date.parse(result.generatedAt)
  const now = (opts.now ?? new Date()).getTime()
  if (!Number.isFinite(at) || now - at > (opts.maxAgeMs ?? PREFLIGHT_MAX_AGE_MS) || at - now > 60_000) {
    throw new PayoutPreflightBlockedError(
      blocked(`preflight result too old or from the future (${result.generatedAt})`),
    )
  }
  const ids = new Set(result.checks.map((c) => c.id))
  if (REQUIRED_PREFLIGHT_CHECKS.some((id) => !ids.has(id))) {
    throw new PayoutPreflightBlockedError(blocked("preflight result incomplete"))
  }
  if (result.verdict === "BLOCKED" || result.checks.some((c) => c.status === "BLOCKED")) {
    throw new PayoutPreflightBlockedError(result)
  }
}
