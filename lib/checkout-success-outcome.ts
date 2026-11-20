/**
 * What the payment-success page may truthfully say — pure, shared by the server result and the screen.
 *
 * A checkout line the buyer paid for but that produced no order is « unallocated » (`lib/unallocated-line.ts`): its trace
 * is an `AuditLog` row keyed `<session>:line:<i>`, and a refund of it leaves a second row on the same key. Before this,
 * the page said « Payment confirmed — your order will appear in your account within moments » for such a line: it never
 * would. The page now says the item could not be confirmed and will not be shipped, then states the REAL refund state
 * (`lib/unallocated-buyer-notice.ts`): « not issued yet », « requested », « being processed » or « refunded ».
 */

import { noticeCopyKey, type RefundState } from "@/lib/unallocated-buyer-notice"

/** The page's refund sentence: the same four states as the buyer e-mail, never a promise the facts do not support. */
export function refundSentenceKey(state: RefundState | null | undefined): "notTriggered" | "requested" | "inProgress" | "confirmed" | null {
  // An unexplained refund on the payment: say nothing about money rather than « no refund issued ».
  if (state === "uncertain") return null
  return noticeCopyKey("initial", state ?? "not_triggered")
}

export type SuccessOutcome = "error" | "fulfilled" | "partially_unallocated" | "unallocated" | "verifying" | "pending"

export function successOutcome(p: { error?: string; fulfilled?: boolean; verifying?: boolean; unallocatedLines?: number }): SuccessOutcome {
  if (p.error === "missing_session") return "error"
  const lost = (p.unallocatedLines ?? 0) > 0
  if (p.fulfilled) return lost ? "partially_unallocated" : "fulfilled"
  if (lost) return "unallocated"
  return p.verifying ? "verifying" : "pending"
}

/** The page keeps polling only while an order can still appear. */
export function shouldKeepVerifying(p: { paid?: boolean; fulfilled?: boolean; unallocatedLines?: number }): boolean {
  return Boolean(p.paid) && !p.fulfilled && !((p.unallocatedLines ?? 0) > 0)
}
