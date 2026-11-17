/**
 * Telling the BUYER that a line they paid for produced no order (`lib/unallocated-line.ts`) — pure rules, no I/O.
 *
 * Refund state, read from facts, never assumed (one checkout session = the weakest state of its lost lines):
 * - `not_triggered` no refund exists for the line (automatic refunds are off by default; a failed / canceled refund
 *                   counts as none) — the buyer is told NOTHING about a refund: no promise while none is guaranteed;
 * - `requested`     Affisell created a refund (its id is recorded) but its status could not be read right now;
 * - `in_progress`   Stripe holds the refund and is processing it (`pending`, `requires_action`);
 * - `confirmed`     Stripe reports it `succeeded` (the bank still takes a few days to show it — said, not promised).
 *
 * Notifications: `initial` once per session (its wording follows the state at send time) and `refund_confirmed` once
 * per session, only when the initial notice did not already say « confirmed ». Each send attempt is claimed by a row
 * with a deterministic id BEFORE sending and closed by a `sent` / `failed` row; a claim without an outcome is « in
 * doubt » (the provider may have sent it) and is NEVER retried automatically — the provider's idempotency key covers a
 * crash between send and record for 24 h, after that a human decides. Nothing here carries an e-mail address, a
 * reason code or an internal id into the buyer's text.
 */

export const BUYER_NOTICE_CLAIM_ACTION = "payment.unallocated_line.buyer_notice"
export const BUYER_NOTICE_SENT_ACTION = "payment.unallocated_line.buyer_notice.sent"
export const BUYER_NOTICE_FAILED_ACTION = "payment.unallocated_line.buyer_notice.failed"
export const BUYER_NOTICE_ENTITY_TYPE = "StripeCheckoutSession"
export const BUYER_NOTICE_MAX_ATTEMPTS = 5
/** A claim younger than this is a send in flight, not a lost one. */
export const BUYER_NOTICE_IN_FLIGHT_MS = 5 * 60_000

export type RefundState = "not_triggered" | "requested" | "in_progress" | "confirmed"
export type NoticeKind = "initial" | "refund_confirmed"

const ORDER: Record<RefundState, number> = { not_triggered: 0, requested: 1, in_progress: 2, confirmed: 3 }

/** The kill switch: no buyer e-mail unless this is exactly `true` (founder decision before any real send). */
export function isBuyerNoticeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.UNALLOCATED_LINE_BUYER_EMAIL?.trim() === "true"
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

type AttemptView = { attempt: number; state: RefundState | null; outcome: "sent" | "failed" | null; createdAt: Date }

function attemptsOf(sessionId: string, kind: NoticeKind, rows: NoticeRow[]): AttemptView[] {
  const prefix = `unallocated-buyer-notice:${sessionId}:${kind}:`
  const byAttempt = new Map<number, AttemptView>()
  for (const r of rows) {
    if (!r.id.startsWith(prefix)) continue
    const rest = r.id.slice(prefix.length)
    const m = /^(\d+)(?::(sent|failed))?$/.exec(rest)
    if (!m) continue
    const n = Number(m[1])
    const v = byAttempt.get(n) ?? { attempt: n, state: null, outcome: null, createdAt: r.createdAt }
    if (!m[2] && r.action === BUYER_NOTICE_CLAIM_ACTION) {
      v.createdAt = r.createdAt
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
  | { action: "none"; reason: "already_sent" | "nothing_new" | "in_flight" | "in_doubt" | "too_many_failures" }

/** What to do for one kind, given the rows already written. */
function planKind(sessionId: string, kind: NoticeKind, rows: NoticeRow[], now: Date): NoticePlan | { sentState: RefundState | null } {
  const attempts = attemptsOf(sessionId, kind, rows)
  const sent = attempts.find((a) => a.outcome === "sent")
  if (sent) return { sentState: sent.state }
  const last = attempts[attempts.length - 1]
  if (last && last.outcome === null) {
    return now.getTime() - last.createdAt.getTime() < BUYER_NOTICE_IN_FLIGHT_MS
      ? { action: "none", reason: "in_flight" }
      : { action: "none", reason: "in_doubt" }
  }
  if (attempts.length >= BUYER_NOTICE_MAX_ATTEMPTS) return { action: "none", reason: "too_many_failures" }
  return { action: "send", kind, attempt: (last?.attempt ?? 0) + 1 }
}

/** The next notice for a session: the initial one first; the confirmation only once the refund is confirmed. */
export function planBuyerNotice(sessionId: string, state: RefundState, rows: NoticeRow[], now: Date): NoticePlan {
  const initial = planKind(sessionId, "initial", rows, now)
  if (!("sentState" in initial)) return initial
  if (state !== "confirmed" || initial.sentState === "confirmed") return { action: "none", reason: initial.sentState === "confirmed" ? "already_sent" : "nothing_new" }
  const confirmed = planKind(sessionId, "refund_confirmed", rows, now)
  return "sentState" in confirmed ? { action: "none", reason: "already_sent" } : confirmed
}

/** Which text the buyer gets: never a refund wording the state does not support. */
export function noticeCopyKey(kind: NoticeKind, state: RefundState): "notTriggered" | "requested" | "inProgress" | "confirmed" {
  if (kind === "refund_confirmed") return "confirmed"
  return state === "not_triggered" ? "notTriggered" : state === "requested" ? "requested" : state === "in_progress" ? "inProgress" : "confirmed"
}

/** A recipient Affisell may write to: the address the payer gave Stripe for THIS paid session, well-formed. */
export function verifiedRecipient(session: { payment_status?: string | null; customer_details?: { email?: string | null } | null } | null): string | null {
  if (!session || session.payment_status !== "paid") return null
  const email = session.customer_details?.email?.trim() ?? ""
  if (email.length > 254 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return null
  return email
}
