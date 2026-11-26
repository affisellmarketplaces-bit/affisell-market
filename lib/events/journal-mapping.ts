/**
 * Event spine — step S2: the BUSINESS JOURNAL, derived from the tables that already hold the facts.
 *
 * Pure mapping (no Prisma): one source row → one transactional event, with a DETERMINISTIC eventId so that projecting
 * the same rows twice (a cron re-run, an overlapping window, a backfill) never creates a second event
 * (`recordEvents` → `eventId` unique + skipDuplicates).
 *
 *   Order (paidAt set)      → purchase            purchase:{orderId}
 *   OrderStripeRefund       → refund              refund:{stripeRefundId}
 *   OrderReturn             → return_requested    return_requested:{returnId}
 *   OrderReturn (terminal)  → return_resolved     return_resolved:{returnId}
 *   Order.deliveredAt       → delivery            delivery:{orderId}
 *   Review (published)      → review_created      review_created:{reviewId}
 *   AffiliateProduct        → creator_product_added  creator_product_added:{listingId}
 *
 * Why a projection and not emitters in the payment code: nothing is added to the money path (no latency, no new
 * failure mode inside a payment transaction), history can be rebuilt (backfill), and every event points back to the
 * row it came from. Transactional events never carry a visitor identifier or a channel (enforced again by
 * `buildEventRow` and the database CHECK constraints).
 */
import type { ServerEventInput } from "@/lib/events/row"

/**
 * Is the business journal on? Off unless `EVENTS_JOURNAL=on` — gates the writes (projector) AND the reads that act on
 * them (measured refund rates), so removing the variable is a full rollback.
 */
export function isJournalEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EVENTS_JOURNAL?.trim().toLowerCase() === "on"
}

/** Final states of a return (lib/order-return-types.ts TERMINAL_RETURN_STATUSES). */
export const TERMINAL_RETURN_STATUSES = ["REFUNDED", "REJECTED", "CANCELLED"] as const

export const JOURNAL_SOURCE = "journal_projection"

export type PurchaseSource = {
  id: string
  productId: string
  affiliateProductId: string
  supplierId: string
  affiliateId: string
  quantity: number
  totalCents: number | null
  currency: string | null
  stripeSessionId: string
  /** Set when the payment succeeded (lib/stripe-marketplace-fulfill.ts) — the same truth the sales stats use. */
  paidAt: Date | null
}

/** A purchase is an order whose payment succeeded: `paidAt` — never a status (an expired checkout becomes CANCELLED). */
export function purchaseEvent(o: PurchaseSource): ServerEventInput | null {
  if (!o.paidAt) return null
  return {
    eventId: `purchase:${o.id}`,
    name: "purchase",
    occurredAt: o.paidAt,
    orderId: o.id,
    productId: o.productId,
    listingId: o.affiliateProductId,
    supplierId: o.supplierId,
    creatorId: o.affiliateId,
    source: JOURNAL_SOURCE,
    properties: {
      amount_cents: o.totalCents ?? undefined,
      currency: o.currency ?? "EUR",
      quantity: o.quantity,
      stripe_session_id: o.stripeSessionId,
    },
  }
}

export type RefundSource = {
  stripeRefundId: string
  orderId: string
  amountCents: number
  reason: string | null
  createdAt: Date
  order: { productId: string; affiliateProductId: string; supplierId: string; affiliateId: string; currency: string | null }
}

/** Stripe refund reasons → the journal's reason_code vocabulary (UPPER_SNAKE). */
function refundReasonCode(reason: string | null): string | undefined {
  if (!reason) return undefined
  const code = reason.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  return /^[A-Z][A-Z0-9_]{1,39}$/.test(code) ? code : undefined
}

export function refundEvent(r: RefundSource): ServerEventInput {
  return {
    eventId: `refund:${r.stripeRefundId}`,
    name: "refund",
    occurredAt: r.createdAt,
    orderId: r.orderId,
    productId: r.order.productId,
    listingId: r.order.affiliateProductId,
    supplierId: r.order.supplierId,
    creatorId: r.order.affiliateId,
    source: JOURNAL_SOURCE,
    properties: {
      amount_cents: r.amountCents,
      currency: r.order.currency ?? "EUR",
      reason_code: refundReasonCode(r.reason),
    },
  }
}

export type ReturnSource = {
  id: string
  orderId: string
  status: string
  reasonCode: string
  createdAt: Date
  updatedAt: Date
  refundedAt: Date | null
  order: { productId: string; supplierId: string; affiliateId: string }
}

export function returnEvents(r: ReturnSource): ServerEventInput[] {
  const common = {
    orderId: r.orderId,
    productId: r.order.productId,
    supplierId: r.order.supplierId,
    creatorId: r.order.affiliateId,
    source: JOURNAL_SOURCE,
  }
  const out: ServerEventInput[] = [
    {
      ...common,
      eventId: `return_requested:${r.id}`,
      name: "return_requested",
      occurredAt: r.createdAt,
      properties: { reason_code: r.reasonCode },
    },
  ]
  if ((TERMINAL_RETURN_STATUSES as readonly string[]).includes(r.status)) {
    out.push({
      ...common,
      eventId: `return_resolved:${r.id}`,
      name: "return_resolved",
      occurredAt: r.refundedAt ?? r.updatedAt,
      properties: { outcome: r.status.toLowerCase(), reason_code: r.reasonCode },
    })
  }
  return out
}

export type DeliverySource = {
  id: string
  productId: string
  supplierId: string
  affiliateId: string
  deliveredAt: Date | null
}

export function deliveryEvent(o: DeliverySource): ServerEventInput | null {
  if (!o.deliveredAt) return null
  return {
    eventId: `delivery:${o.id}`,
    name: "delivery",
    occurredAt: o.deliveredAt,
    orderId: o.id,
    productId: o.productId,
    supplierId: o.supplierId,
    creatorId: o.affiliateId,
    source: JOURNAL_SOURCE,
    properties: { delivered_at_source: "order" },
  }
}

export type ReviewSource = {
  id: string
  productId: string
  orderId: string | null
  rating: number
  status: string
  createdAt: Date
  publishedAt: Date | null
}

export function reviewEvent(r: ReviewSource): ServerEventInput | null {
  if (r.status !== "PUBLISHED") return null
  return {
    eventId: `review_created:${r.id}`,
    name: "review_created",
    // A review approved after moderation is published later than it was written.
    occurredAt: r.publishedAt ?? r.createdAt,
    productId: r.productId,
    orderId: r.orderId,
    source: JOURNAL_SOURCE,
    properties: { rating: r.rating, outcome: "published" },
  }
}

export type ListingSource = { id: string; productId: string; affiliateId: string; createdAt: Date }

export function listingAddedEvent(l: ListingSource): ServerEventInput {
  return {
    eventId: `creator_product_added:${l.id}`,
    name: "creator_product_added",
    occurredAt: l.createdAt,
    productId: l.productId,
    listingId: l.id,
    creatorId: l.affiliateId,
    source: JOURNAL_SOURCE,
    properties: { surface: "listing" },
  }
}

/**
 * Smoothed refund rate of a product from journal counts — the measured input the net-margin guard was waiting for.
 * Bayesian shrinkage towards `prior` with `priorWeight` pseudo-sales: a product with 1 sale and 1 refund is not
 * declared "100 % refunded"; with many sales the measured rate dominates.
 */
export function smoothedRefundRate(args: {
  purchases: number
  refunds: number
  prior: number
  priorWeight?: number
}): number {
  const n = Math.max(0, Math.floor(args.purchases))
  const r = Math.min(n, Math.max(0, Math.floor(args.refunds)))
  const w = Math.max(0, args.priorWeight ?? 20)
  const prior = Math.min(1, Math.max(0, args.prior))
  if (n + w === 0) return prior
  return (r + w * prior) / (n + w)
}
