/**
 * Chantier 6 — resuming the transfers owed to a partner once their Stripe Connect account exists. PURE.
 *
 * `scheduleMarketplaceTransferAttempts` creates no `TransferAttempt` for a party without a destination, and nothing
 * re-schedules it later. This module decides, leg by leg, what a resume WOULD do. The only write it can lead to is a
 * PENDING `TransferAttempt` (the existing `process-transfers` cron then pays it) — so applying a plan is a money-path
 * action, gated by `OWED_TRANSFER_RESUME_MODE` (default `off`; `enforce` is the founder's decision).
 *
 * Never a double payment:
 * - one attempt per (order, role) — `TransferAttempt @@unique([orderId, role])`, written with skipDuplicates; a leg that
 *   already has ANY attempt (pending, failed, paid, reversed) is never touched (`already_scheduled`);
 * - the amount is the settlement's own planned leg, recomputed at apply time from the order (same functions as the
 *   scheduler), never taken from the plan the admin looked at;
 * - a partially refunded order is never resumed automatically (`partially_refunded`): the refund already reversed the
 *   OTHER legs pro rata, and a late transfer would have to be netted by hand;
 * - an order with an open dispute is held (`dispute_open`), a closed order owes nothing (`order_closed`);
 * - a leg already paid by ANOTHER rail (Lightning, a ledger payout carrying a Stripe transfer, an order marked PAID) is
 *   never resumed (`paid_elsewhere`) — the same rule `process-transfers` re-checks before paying;
 * - a partner whose Connect account is known not to accept transfers yet is `account_not_ready` (nothing created:
 *   `process-transfers` would only fail it); a partner who CHANGED account is resumed to the account on file TODAY;
 * - an attempt that already exists in FAILED state (cron error, onboarding) is never duplicated — it is reported for
 *   the existing retry path (`failedAttempts` in the plan), never re-created;
 * - every created attempt carries an AuditLog row with a deterministic id (`owed-resume:<order>:<role>`): replaying the
 *   same plan writes nothing twice and says who resumed what.
 */
export type ResumeRole = "SUPPLIER" | "AFFILIATE"

export type ResumeLegFacts = {
  role: ResumeRole
  partnerId: string
  plannedCents: number
  /** The partner's Connect account TODAY (null = still none). */
  destination: string | null
  hasAttempt: boolean
  /** Paid by another rail (Lightning, ledger payout with a Stripe transfer id, order marked PAID) — same rule as
   *  `marketplaceRoleAlreadySettled`, which `process-transfers` applies too. */
  paidElsewhere?: boolean
  /** The partner's account is known NOT to accept transfers yet (Connect onboarding unfinished). Optional. */
  destinationNotReady?: boolean
}

export type ResumeOrderFacts = {
  orderId: string
  paidAt: Date | null
  closed: boolean
  disputeOpen: boolean
  refundedCents: number
  /** The platform auto-buy account: Affisell does not owe itself a transfer. */
  supplierIsPlatform: boolean
  legs: ReadonlyArray<ResumeLegFacts>
}

export type ResumeLegDecision =
  | "create"
  | "still_no_connect"
  | "already_scheduled"
  | "dispute_open"
  | "partially_refunded"
  | "order_closed"
  | "nothing_owed"
  | "platform_account"
  | "paid_elsewhere"
  | "account_not_ready"

export type ResumeLegPlan = {
  orderId: string
  role: ResumeRole
  partnerId: string
  amountCents: number
  decision: ResumeLegDecision
  destination: string | null
  idempotencyKey: string
}

export const OWED_RESUME_AUDIT_ACTION = "transfer.owed_resume"
export const owedResumeKey = (orderId: string, role: ResumeRole) => `owed-resume:${orderId}:${role}`

export type OwedResumeMode = "off" | "enforce"

/** `OWED_TRANSFER_RESUME_MODE`: only the exact word `enforce` allows creating attempts. */
export function resolveOwedResumeMode(env: Record<string, string | undefined> = process.env): OwedResumeMode {
  return env.OWED_TRANSFER_RESUME_MODE?.trim() === "enforce" ? "enforce" : "off"
}

export function planOrderResume(order: ResumeOrderFacts): ResumeLegPlan[] {
  return order.legs.map((leg) => {
    const base = {
      orderId: order.orderId,
      role: leg.role,
      partnerId: leg.partnerId,
      amountCents: Math.max(0, Math.round(leg.plannedCents)),
      destination: leg.destination,
      idempotencyKey: owedResumeKey(order.orderId, leg.role),
    }
    const decide = (decision: ResumeLegDecision): ResumeLegPlan => ({ ...base, decision })
    if (leg.role === "SUPPLIER" && order.supplierIsPlatform) return decide("platform_account")
    if (!(leg.plannedCents > 0)) return decide("nothing_owed")
    if (leg.hasAttempt) return decide("already_scheduled")
    if (leg.paidElsewhere) return decide("paid_elsewhere")
    if (order.closed) return decide("order_closed")
    if (order.disputeOpen) return decide("dispute_open")
    if (order.refundedCents > 0) return decide("partially_refunded")
    if (!leg.destination?.trim()) return decide("still_no_connect")
    if (leg.destinationNotReady) return decide("account_not_ready")
    return decide("create")
  })
}

export type ResumeSummary = {
  byDecision: Record<ResumeLegDecision, { legs: number; cents: number }>
  resumable: { legs: number; cents: number; partners: number }
}

export function summarizeResume(plans: ReadonlyArray<ResumeLegPlan>): ResumeSummary {
  const zero = () => ({ legs: 0, cents: 0 })
  const byDecision = {
    create: zero(),
    still_no_connect: zero(),
    already_scheduled: zero(),
    dispute_open: zero(),
    partially_refunded: zero(),
    order_closed: zero(),
    nothing_owed: zero(),
    platform_account: zero(),
    paid_elsewhere: zero(),
    account_not_ready: zero(),
  } satisfies ResumeSummary["byDecision"]
  const partners = new Set<string>()
  for (const p of plans) {
    byDecision[p.decision].legs += 1
    byDecision[p.decision].cents += p.amountCents
    if (p.decision === "create") partners.add(`${p.role}:${p.partnerId}`)
  }
  return {
    byDecision,
    resumable: { legs: byDecision.create.legs, cents: byDecision.create.cents, partners: partners.size },
  }
}
