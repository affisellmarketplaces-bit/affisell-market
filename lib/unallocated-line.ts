/**
 * A checkout line the buyer PAID for but that produced no order ("UNALLOCATED_LINE") — finalisation master doc, D6.
 *
 * Pure part (no I/O, safe to import from anywhere, including the Stripe refund webhook handler): the reasons, the keys
 * of the durable trace, the refund amount of a line and the switch that guards the automatic refund. The I/O part lives
 * in `lib/unallocated-line.server.ts`.
 *
 * Why a trace in `AuditLog` (no schema migration): it is the project's generic, append-only journal
 * (`action` / `entityType` / `entityId` / `payload`), nothing rewrites or purges it, and its primary key is a plain
 * string, so a deterministic id makes the trace idempotent (a replay inserts the same id and hits the unique key).
 * `OpsSignal` is rewritten by every Sentinel scan (a signal that no collector re-detects is auto-resolved) and
 * `ProcessedWebhook` is the Stripe-event idempotency ledger read by the webhook replay logic — overloading either would
 * mix a business fact with machinery that has its own rules.
 */

/** Why a paid line could not be turned into an order. */
export const UNALLOCATED_LINE_REASONS = [
  /** The listing the buyer paid for no longer exists. */
  "listing_not_found",
  /** The listing exists but is inactive (and the checkout did not pre-create an order for it). */
  "listing_inactive",
  /** The product has no explicit supplier commission: the settlement can not be computed. */
  "commission_not_explicit",
  /** The stock ran out between the checkout and the payment (G1): selling it would oversell. */
  "insufficient_stock",
] as const

export type UnallocatedLineReason = (typeof UNALLOCATED_LINE_REASONS)[number]

/** `AuditLog.action` of the trace written when a paid line is found without an order. */
export const UNALLOCATED_LINE_AUDIT_ACTION = "payment.unallocated_line"
/** `AuditLog.action` of the trace written once the line has been refunded automatically. */
export const UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION = "payment.unallocated_line.refunded"
/** `AuditLog.entityType` of both traces; `entityId` is `unallocatedLineKey()`. */
export const UNALLOCATED_LINE_AUDIT_ENTITY_TYPE = "StripeCheckoutLine"

/**
 * Metadata put on the Stripe refund of such a line. The `charge.refunded` handler reads it so the refund is NOT
 * attributed to a sibling order of the same charge (a single remaining order would otherwise look "fully refunded").
 */
export const UNALLOCATED_LINE_REFUND_METADATA_KEY = "affisell_unallocated_line"

/** Same naming as the order rows of a cart checkout (`<session>:line:<index>`); the single-line checkout is index 0. */
export function unallocatedLineKey(sessionId: string, lineIndex: number): string {
  return `${sessionId}:line:${lineIndex}`
}

/** Deterministic `AuditLog.id`: a second insert for the same line hits the primary key instead of duplicating. */
export function unallocatedLineAuditId(key: string): string {
  return `unallocated-line:${key}`
}

export function unallocatedLineRefundedAuditId(key: string): string {
  return `unallocated-line-refunded:${key}`
}

/**
 * Automatic refund of an unallocated line: OFF unless `UNALLOCATED_LINE_AUTO_REFUND=true` (exact, after trimming).
 * Real money leaves the platform account — it must never start without an explicit activation (owner rule, 2026-11-13).
 * Read per call so flipping the variable needs no deploy of code.
 */
export function isUnallocatedLineAutoRefundEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.UNALLOCATED_LINE_AUTO_REFUND?.trim() === "true"
}

/** True when a Stripe refund was created by the unallocated-line refund (see the metadata key). */
export function isUnallocatedLineRefund(refund: {
  metadata?: Record<string, string | null | undefined> | null
}): boolean {
  return refund.metadata?.[UNALLOCATED_LINE_REFUND_METADATA_KEY] === "1"
}

/**
 * What the buyer paid for one line: the HT amount actually collected plus its share of the checkout VAT — the same
 * formula as `Order.totalCents` of a paid line, capped at the amount of the session. `null` when the HT amount is
 * unknown (listing gone and no `linePaids` in the metadata): nothing can be refunded automatically then.
 */
export function computeUnallocatedLineRefundCents(args: {
  paidLineCents: number | null | undefined
  checkoutSubtotalCents: number
  checkoutTaxCents: number
  checkoutAmountTotalCents: number
}): number | null {
  if (args.paidLineCents == null || !Number.isFinite(args.paidLineCents)) return null
  const paid = Math.max(0, Math.round(args.paidLineCents))
  const tax =
    args.checkoutSubtotalCents > 0 && args.checkoutTaxCents > 0
      ? Math.round((args.checkoutTaxCents * paid) / args.checkoutSubtotalCents)
      : 0
  let total = paid + tax
  if (args.checkoutAmountTotalCents > 0) total = Math.min(total, args.checkoutAmountTotalCents)
  return total
}

/** One paid line that produced no order, as collected during the fulfilment. */
export type UnallocatedLine = {
  /** Position in the cart (`0` for a single-line checkout). */
  lineIndex: number
  reason: UnallocatedLineReason
  affiliateProductId: string | null
  productId: string | null
  qty: number
  /** HT cents the buyer paid for the line (after store credit), `null` when unknown. */
  paidLineCents: number | null
  /** Small, non-personal facts about the reason (available stock, …). */
  detail?: Record<string, unknown>
}

/** What the audit trail knows about a traced unallocated line, as read back when a refund has to be attributed. */
export type TracedUnallocatedLine = {
  key: string
  /** HT + VAT the line collected (`null` when it was unknown): what a refund of this line is expected to be. */
  refundableCents: number | null
  /** Set once the line was refunded (by the automatic refund or recognised from a manual one). */
  refundedByRefundId: string | null
}

export type RefundClass =
  /** Belongs to an order of the charge: the regular order refund logic applies. */
  | { kind: "order" }
  /** Belongs to a paid line that has no order (`lineKey` = the traced line it was matched to, when known). */
  | { kind: "unallocated"; lineKey: string | null; via: "marker" | "recorded" | "amount" }
  /** Can not be told apart from an order refund: attributed to NOTHING, ops are alerted. */
  | { kind: "ambiguous" }

/**
 * Decides whom a refund of a charge belongs to, WITHOUT relying on metadata alone — a refund made by hand in the Stripe
 * dashboard (the default remedy while the automatic refund is off) carries none.
 *
 * Only charges that carry traced unallocated lines are affected: with none, every refund without the marker is an order
 * refund, exactly as before. With traced lines, in this order:
 *  1. the marker `affisell_unallocated_line=1` (automatic refund) → unallocated;
 *  2. a refund id already recorded on a line's `refunded` trace → unallocated (replay of the webhook);
 *  3. `metadata.orderId` set → order (explicit);
 *  4. the amount equals the refundable amount of a traced line not refunded yet → unallocated, unless it ALSO equals an
 *     order's charged total → ambiguous (never guess which one it was);
 *  5. anything else → ambiguous: on a charge that carries unallocated money a bare refund can not safely be applied to
 *     the sibling order (a single remaining order would be judged "fully refunded" from the charge-level total).
 * `claimed` holds the lines already matched during this pass, so two refunds do not claim the same line.
 */
export function classifyRefundForCharge(args: {
  refund: { id: string; amount?: number | null; metadata?: Record<string, string | null | undefined> | null }
  tracedLines: TracedUnallocatedLine[]
  orderChargedTotalsCents: number[]
  claimed?: Set<string>
}): RefundClass {
  const { refund, tracedLines } = args
  const claimed = args.claimed ?? new Set<string>()
  const amount = Math.round(refund.amount ?? 0)

  if (isUnallocatedLineRefund(refund)) {
    const sid = refund.metadata?.checkoutSessionId?.trim()
    const idx = refund.metadata?.lineIndex?.trim()
    return { kind: "unallocated", lineKey: sid && idx ? unallocatedLineKey(sid, Number(idx)) : null, via: "marker" }
  }
  if (tracedLines.length === 0) return { kind: "order" }

  const recorded = tracedLines.find((l) => l.refundedByRefundId === refund.id)
  if (recorded) return { kind: "unallocated", lineKey: recorded.key, via: "recorded" }

  if (refund.metadata?.orderId?.trim()) return { kind: "order" }

  const candidates = tracedLines.filter(
    (l) => !l.refundedByRefundId && !claimed.has(l.key) && l.refundableCents != null && l.refundableCents === amount
  )
  if (candidates.length > 0) {
    if (args.orderChargedTotalsCents.some((t) => t === amount)) return { kind: "ambiguous" }
    const line = [...candidates].sort((a, b) => a.key.localeCompare(b.key))[0]!
    claimed.add(line.key)
    return { kind: "unallocated", lineKey: line.key, via: "amount" }
  }
  return { kind: "ambiguous" }
}
