/**
 * Telling the BUYER that a line they paid for produced no order (`lib/unallocated-line.ts`) — pure rules, no I/O.
 *
 * Refund state, read from facts, never assumed (one checkout session = the weakest state of its lost lines):
 * - `not_triggered` no refund exists for the line (automatic refunds are off by default; a failed / canceled refund
 *                   counts as none) — the buyer is told NOTHING about a refund: no promise while none is guaranteed;
 * - `requested`     Affisell created a refund (its id is recorded) but its status could not be read right now;
 * - `in_progress`   Stripe holds the refund and is processing it (`pending`, `requires_action`);
 * - `confirmed`     Stripe reports it `succeeded` (the bank still takes a few days to show it — said, not promised);
 * - `uncertain`     no refund is recorded for the line, but the payment carries a refund nobody can attribute (no proof
 *                   row, no `metadata.orderId`): the buyer may already have been paid back — NOTHING is said about a
 *                   refund and no e-mail goes out until a human reconciles it (or the refunds can not be read at all).
 *
 * Notifications: `initial` once per session (its wording follows the state at send time) and `refund_confirmed` once
 * per session, only when the initial notice did not already say « confirmed ». Each send attempt is claimed by a row
 * with a deterministic id BEFORE sending and closed by a `sent` / `failed` row; a claim without an outcome is « in
 * doubt » (the provider may have sent it). Resend dedupes the same key + the SAME payload for 24 h, so a claim in doubt
 * younger than that is RECOVERED by re-sending exactly what it claimed (state, locale and amount are stored in the
 * claim) under the same key — Resend either returns the original e-mail or sends it now, never twice. Older than that,
 * or if Resend says the payload differs, it is alerted ONCE and left to a human (admin resolve action). Nothing here
 * carries an e-mail address, a reason code or an internal id into the buyer's text.
 *
 * Rollout switch `UNALLOCATED_LINE_BUYER_EMAIL`: unset / anything else = off (nothing read, claimed or sent), `shadow` =
 * everything is computed and logged as « would send » but nothing is claimed or sent, `true` = on.
 */

export const BUYER_NOTICE_CLAIM_ACTION = "payment.unallocated_line.buyer_notice"
export const BUYER_NOTICE_SENT_ACTION = "payment.unallocated_line.buyer_notice.sent"
export const BUYER_NOTICE_FAILED_ACTION = "payment.unallocated_line.buyer_notice.failed"
export const BUYER_NOTICE_ENTITY_TYPE = "StripeCheckoutSession"
export const BUYER_NOTICE_MAX_ATTEMPTS = 5
/** A claim younger than this is a send in flight, not a lost one. */
export const BUYER_NOTICE_IN_FLIGHT_MS = 5 * 60_000
/** Resend keeps an idempotency key 24 h; recover only well inside that window. */
export const BUYER_NOTICE_RECOVERY_MS = 20 * 3_600_000
export const BUYER_NOTICE_DOUBT_ALERT_ACTION = "payment.unallocated_line.buyer_notice.doubt_alerted"

export type RefundState = "uncertain" | "not_triggered" | "requested" | "in_progress" | "confirmed"
export type NoticeKind = "initial" | "refund_confirmed"

const ORDER: Record<RefundState, number> = { uncertain: -1, not_triggered: 0, requested: 1, in_progress: 2, confirmed: 3 }

export type BuyerNoticeMode = "off" | "shadow" | "on"

/** The rollout switch: `true` = on, `shadow` = compute and log only, anything else = off (founder decision). */
export function buyerNoticeMode(env: Record<string, string | undefined> = process.env): BuyerNoticeMode {
  const v = env.UNALLOCATED_LINE_BUYER_EMAIL?.trim()
  return v === "true" ? "on" : v === "shadow" ? "shadow" : "off"
}

/** True only when real e-mails may go out. */
export function isBuyerNoticeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return buyerNoticeMode(env) === "on"
}

/**
 * Refunds on the payment that no fact explains: not one of the lines' proofs, not an order refund made by the app
 * (`metadata.orderId`), not a failed / canceled one. Any → the session is `uncertain`.
 */
export function unexplainedRefunds(
  refunds: Array<{ id: string; status?: string | null; metadata?: Record<string, string> | null }>,
  knownRefundIds: Set<string>
): number {
  return refunds.filter((r) => r.status !== "failed" && r.status !== "canceled" && !knownRefundIds.has(r.id) && !r.metadata?.orderId).length
}

/** One lost line: its recorded refund id (if any) and the status Stripe reports for it (null = not readable). */
export function lineRefundState(refundId: string | null, stripeStatus: string | null): RefundState {
  if (!refundId) return "not_triggered"
  if (stripeStatus === "succeeded") return "confirmed"
  if (stripeStatus === "pending" || stripeStatus === "requires_action") return "in_progress"
  if (stripeStatus === "failed" || stripeStatus === "canceled") return "not_triggered"
  return "requested"
}

/** A session is only as far along as its least advanced lost line. */
export function sessionRefundState(lines: RefundState[]): RefundState {
  if (lines.length === 0) return "not_triggered"
  return lines.reduce((a, b) => (ORDER[b] < ORDER[a] ? b : a))
}

/** True only when the text may say money is (being) returned. */
export function mayMentionRefund(state: RefundState): boolean {
  return state === "requested" || state === "in_progress" || state === "confirmed"
}

export type NoticeRow = { id: string; action: string; createdAt: Date; payload: unknown }

export function claimId(sessionId: string, kind: NoticeKind, attempt: number): string {
  return `unallocated-buyer-notice:${sessionId}:${kind}:${attempt}`
}

type AttemptView = { attempt: number; state: RefundState | null; outcome: "sent" | "failed" | null; createdAt: Date; payload: unknown }

function attemptsOf(sessionId: string, kind: NoticeKind, rows: NoticeRow[]): AttemptView[] {
  const prefix = `unallocated-buyer-notice:${sessionId}:${kind}:`
  const byAttempt = new Map<number, AttemptView>()
  for (const r of rows) {
    if (!r.id.startsWith(prefix)) continue
    const rest = r.id.slice(prefix.length)
    const m = /^(\d+)(?::(sent|failed|alerted))?$/.exec(rest)
    if (!m) continue
    const n = Number(m[1])
    const v = byAttempt.get(n) ?? { attempt: n, state: null, outcome: null, createdAt: r.createdAt, payload: null }
    if (!m[2] && r.action === BUYER_NOTICE_CLAIM_ACTION) {
      v.createdAt = r.createdAt
      v.payload = r.payload
      const s = (r.payload as { state?: unknown } | null)?.state
      v.state = typeof s === "string" && s in ORDER ? (s as RefundState) : null
    }
    if (m[2] === "sent" && r.action === BUYER_NOTICE_SENT_ACTION) v.outcome = "sent"
    if (m[2] === "failed" && r.action === BUYER_NOTICE_FAILED_ACTION && v.outcome !== "sent") v.outcome = "failed"
    byAttempt.set(n, v)
  }
  return [...byAttempt.values()].sort((a, b) => a.attempt - b.attempt)
}

export type NoticePlan =
  | { action: "send"; kind: NoticeKind; attempt: number }
  /** Re-send EXACTLY what this claim recorded, under the same key (Resend dedupes it for 24 h). */
  | { action: "recover"; kind: NoticeKind; attempt: number; claimed: { state: RefundState | null; payload: unknown } }
  | { action: "none"; reason: "already_sent" | "nothing_new" | "in_flight" | "in_doubt" | "too_many_failures" | "uncertain_hold"; attempt?: number; kind?: NoticeKind }

/** What to do for one kind, given the rows already written. */
function planKind(sessionId: string, kind: NoticeKind, rows: NoticeRow[], now: Date): NoticePlan | { sentState: RefundState | null } {
  const attempts = attemptsOf(sessionId, kind, rows)
  const sent = attempts.find((a) => a.outcome === "sent")
  if (sent) return { sentState: sent.state }
  const last = attempts[attempts.length - 1]
  if (last && last.outcome === null) {
    const age = now.getTime() - last.createdAt.getTime()
    if (age < BUYER_NOTICE_IN_FLIGHT_MS) return { action: "none", reason: "in_flight" }
    if (age < BUYER_NOTICE_RECOVERY_MS) return { action: "recover", kind, attempt: last.attempt, claimed: { state: last.state, payload: last.payload } }
    return { action: "none", reason: "in_doubt", attempt: last.attempt, kind }
  }
  if (attempts.length >= BUYER_NOTICE_MAX_ATTEMPTS) return { action: "none", reason: "too_many_failures" }
  return { action: "send", kind, attempt: (last?.attempt ?? 0) + 1 }
}

/** The next notice for a session: the initial one first; the confirmation only once the refund is confirmed. */
export function planBuyerNotice(sessionId: string, state: RefundState, rows: NoticeRow[], now: Date): NoticePlan {
  const initial = planKind(sessionId, "initial", rows, now)
  if (!("sentState" in initial)) {
    // A fresh notice is never written while a refund on the payment is unexplained; a recovery re-sends what was claimed.
    if (initial.action === "send" && state === "uncertain") return { action: "none", reason: "uncertain_hold" }
    return initial
  }
  if (state !== "confirmed" || initial.sentState === "confirmed") return { action: "none", reason: initial.sentState === "confirmed" ? "already_sent" : "nothing_new" }
  const confirmed = planKind(sessionId, "refund_confirmed", rows, now)
  return "sentState" in confirmed ? { action: "none", reason: "already_sent" } : confirmed
}

/** Which text the buyer gets: never a refund wording the state does not support. */
export function noticeCopyKey(kind: NoticeKind, state: RefundState): "notTriggered" | "requested" | "inProgress" | "confirmed" {
  if (kind === "refund_confirmed") return "confirmed"
  // `uncertain` never gets a fresh e-mail (planBuyerNotice holds it); if a stored claim says so, promise nothing.
  return state === "not_triggered" || state === "uncertain" ? "notTriggered" : state === "requested" ? "requested" : state === "in_progress" ? "inProgress" : "confirmed"
}

/** Sessions whose notices are all done: the cron skips them before any Stripe read. */
export function isNoticeComplete(sessionId: string, rows: NoticeRow[]): boolean {
  const sent = (kind: NoticeKind) => attemptsOf(sessionId, kind, rows).find((a) => a.outcome === "sent")
  return Boolean(sent("refund_confirmed")) || sent("initial")?.state === "confirmed"
}

/** True when the session still waits for its FIRST notice (the cron serves these first). */
export function awaitsInitialNotice(sessionId: string, rows: NoticeRow[]): boolean {
  return !attemptsOf(sessionId, "initial", rows).some((a) => a.outcome === "sent")
}

/** A recipient Affisell may write to: the address the payer gave Stripe for THIS paid session, well-formed. */
export function verifiedRecipient(session: { payment_status?: string | null; customer_details?: { email?: string | null } | null } | null): string | null {
  if (!session || session.payment_status !== "paid") return null
  const email = session.customer_details?.email?.trim() ?? ""
  if (email.length > 254 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return null
  return email
}
