/**
 * What the payment-success page may truthfully say — pure, shared by the server result and the screen.
 *
 * A checkout line the buyer paid for but that produced no order is « unallocated » (`lib/unallocated-line.ts`): its trace
 * is an `AuditLog` row keyed `<session>:line:<i>`, and a refund of it leaves a second row on the same key. Before this,
 * the page said « Payment confirmed — your order will appear in your account within moments » for such a line: it never
 * would. The page now says the item could not be confirmed, will not be shipped, and that its amount is (or will be)
 * refunded — the refund is owed whatever path issues it (automatic flag or operations, alerted with the exact amount).
 */

import { UNALLOCATED_LINE_AUDIT_ACTION, UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION } from "@/lib/unallocated-line"

export const UNALLOCATED_TRACE_ACTION = UNALLOCATED_LINE_AUDIT_ACTION
export const UNALLOCATED_REFUNDED_ACTION = UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION

export type UnallocatedSummary = { lines: number; refunded: number }

/** Distinct traced lines of ONE checkout session, and how many of them already carry a refund proof. */
export function summarizeUnallocatedTraces(sessionId: string, rows: Array<{ action: string; entityId: string | null }>): UnallocatedSummary {
  const prefix = `${sessionId}:line:`
  const traced = new Set<string>()
  const refunded = new Set<string>()
  for (const r of rows) {
    if (!r.entityId?.startsWith(prefix) || !/^\d+$/.test(r.entityId.slice(prefix.length))) continue
    if (r.action === UNALLOCATED_TRACE_ACTION) traced.add(r.entityId)
    else if (r.action === UNALLOCATED_REFUNDED_ACTION) refunded.add(r.entityId)
  }
  return { lines: traced.size, refunded: [...refunded].filter((k) => traced.has(k)).length }
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
