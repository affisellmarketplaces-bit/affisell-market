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
  } | null
  errors?: Partial<Record<"webhooks" | "invariants" | "duplicates" | "consistency", string>>
}

export type PreflightResult = { verdict: PreflightStatus; checks: PreflightCheck[] }

const RANK: Record<PreflightStatus, number> = { PASS: 0, WARNING: 1, BLOCKED: 2 }
const worst = (a: PreflightStatus, b: PreflightStatus) => (RANK[b] > RANK[a] ? b : a)
const notRun = (id: PreflightCheckId, what: string, err?: string): PreflightCheck => ({
  id,
  status: "BLOCKED",
  summary: `${what} could not be checked`,
  evidence: err ? [err] : [],
  recommendation: "Fix the access or the error and run the preflight again; no payout cycle until this check runs.",
})

export function evaluatePayoutPreflight(input: PreflightInput): PreflightResult {
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

  // 5. Stripe ↔ ledger: money Stripe moved for our orders that we did not record.
  if (!input.consistency) {
    checks.push(notRun("stripe_ledger_consistency", "Stripe ↔ ledger consistency", input.errors?.consistency))
  } else {
    const { unrecorded, orderTransfers } = input.consistency
    checks.push({
      id: "stripe_ledger_consistency",
      status: unrecorded.length > 0 ? "BLOCKED" : "PASS",
      summary:
        unrecorded.length > 0
          ? `${unrecorded.length} of ${orderTransfers} Stripe transfers of our orders are not recorded`
          : `${orderTransfers} Stripe transfers of our orders, all recorded`,
      evidence: unrecorded.slice(0, 10).map((u) => `${u.transferId} (${u.transferGroup}, ${u.amount})`),
      recommendation:
        unrecorded.length > 0
          ? "Record or explain each transfer (a path paid without the ledger); the invariants cannot see them otherwise."
          : null,
    })
  }

  return { verdict: checks.reduce<PreflightStatus>((v, c) => worst(v, c.status), "PASS"), checks }
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

/**
 * The future gate (NOT wired anywhere): a payout cycle would call this first and stop on BLOCKED. Kept here so the
 * contract is tested before it is used.
 */
export function assertPayoutPreflightAllows(result: PreflightResult): void {
  if (result.verdict === "BLOCKED") throw new PayoutPreflightBlockedError(result)
}
