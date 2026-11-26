/**
 * Refund-safety primitives (pure, integer cents, no I/O) — finalisation master doc, D4.
 *
 * Three rules every Stripe refund created by the application must follow:
 *  1. The amount is ALWAYS explicit and strictly positive. `stripe.refunds.create` without `amount` (or with
 *     `undefined`) refunds the WHOLE remaining charge, so an amount that "computes to 0" must be refused, never forwarded.
 *  2. What was already refunded counts: a refund can never push the cumulative total above what the order was charged.
 *  3. The same business operation always carries the same Stripe idempotency key, so a retry (timeout, replayed
 *     webhook, double click, cron re-run) cannot create a second refund.
 */

import { createHash } from "node:crypto"

const int = (n: number | null | undefined): number => Math.round(Number.isFinite(n ?? NaN) ? (n as number) : 0)
const pos = (n: number | null | undefined): number => Math.max(0, int(n))

export type RefundAmountDecision =
  | { ok: true; amountCents: number; remainingCents: number }
  | { ok: false; reason: "invalid_refund_amount" | "already_refunded"; remainingCents: number }

/**
 * Amount to send to Stripe for an order charged `chargedTotalCents` of which `alreadyRefundedCents` was already refunded.
 *
 *  - `requestedCents` omitted (`undefined`/`null`) = "refund what is left". Anything else must be a finite number that
 *    rounds to at least 1 cent, otherwise the request is invalid (it used to silently become a FULL refund).
 *  - The result is capped at what is left to refund.
 *  - Nothing left = `already_refunded`; an order that was never charged anything = `invalid_refund_amount`.
 */
export function resolveRefundAmountCents(args: {
  chargedTotalCents: number | null | undefined
  alreadyRefundedCents?: number | null
  requestedCents?: number | null
}): RefundAmountDecision {
  const total = pos(args.chargedTotalCents)
  const already = pos(args.alreadyRefundedCents)
  const remaining = Math.max(0, total - already)

  if (args.requestedCents != null) {
    const requested = args.requestedCents
    if (typeof requested !== "number" || !Number.isFinite(requested) || Math.round(requested) < 1) {
      return { ok: false, reason: "invalid_refund_amount", remainingCents: remaining }
    }
  }

  if (total <= 0) return { ok: false, reason: "invalid_refund_amount", remainingCents: 0 }
  if (remaining <= 0) return { ok: false, reason: "already_refunded", remainingCents: 0 }

  const wanted = args.requestedCents != null ? Math.round(args.requestedCents) : remaining
  return { ok: true, amountCents: Math.min(wanted, remaining), remainingCents: remaining }
}

const MAX_KEY_LENGTH = 200

/**
 * Stable Stripe idempotency key for one refund operation: (order, amount, reason, scope).
 *
 * `scope` names the business operation (`ship_sla_auto_cancel`, `supplier_mark_refunded:<returnId>`, …): two DISTINCT
 * partial refunds of the same amount on the same order need different scopes, a retry of the same one needs the same.
 * Stripe keeps a key for 24 hours, so this is the retry window; the cumulative cap (`resolveRefundAmountCents`) covers
 * what the key cannot.
 */
export function buildRefundIdempotencyKey(parts: {
  orderId: string
  amountCents: number
  reason: string
  scope: string
}): string {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9_.-]/g, "_")
  const raw = `refund:v1:${clean(parts.orderId)}:${int(parts.amountCents)}:${clean(parts.reason)}:${clean(parts.scope)}`
  if (raw.length <= MAX_KEY_LENGTH) return raw
  const digest = createHash("sha256").update(raw).digest("hex")
  return `refund:v1:${clean(parts.orderId).slice(0, 60)}:${int(parts.amountCents)}:${digest}`
}

export type StripeRefundErrorClass = { message: string; retryable: boolean }

/**
 * Is a failed `refunds.create` worth retrying later (network, Stripe outage, rate limit, a request still in flight with
 * the same idempotency key), or does it need a human (invalid request such as "already refunded" / "amount too large",
 * authentication or permission, idempotency key reused with other parameters)?
 */
export function classifyStripeRefundError(error: unknown): StripeRefundErrorClass {
  const message = error instanceof Error ? error.message : String(error)
  const e = (error ?? {}) as { type?: unknown; rawType?: unknown; code?: unknown; statusCode?: unknown }
  const type = String(e.type ?? e.rawType ?? "").toLowerCase()
  const code = String(e.code ?? "").toLowerCase()
  const status = typeof e.statusCode === "number" ? e.statusCode : 0

  if (code === "lock_timeout" || code === "idempotency_key_in_use") return { message, retryable: true }
  if (/connection|rate_?limit|api_?error|apierror/.test(type)) return { message, retryable: true }
  if (status >= 500 || status === 429) return { message, retryable: true }
  if (/invalid_?request|authentication|permission|idempotency|card/.test(type)) return { message, retryable: false }
  if (status >= 400) return { message, retryable: false }
  // Unknown failure (plain Error, fetch failure, timeout): assume transient.
  return { message, retryable: true }
}
