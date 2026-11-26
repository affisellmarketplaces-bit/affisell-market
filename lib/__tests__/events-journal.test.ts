import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildEventRow } from "@/lib/events/row"
import {
  deliveryEvent,
  listingAddedEvent,
  purchaseEvent,
  refundEvent,
  returnEvents,
  reviewEvent,
  smoothedRefundRate,
} from "@/lib/events/journal-mapping"

const t = new Date("2026-11-20T10:00:00Z")
const order = {
  id: "ord_000001",
  productId: "prod_1",
  affiliateProductId: "ap_0000001",
  supplierId: "sup_000001",
  affiliateId: "aff_000001",
  quantity: 2,
  totalCents: 5_990,
  currency: "EUR",
  stripeSessionId: "cs_test_1234567890",
  status: "paid",
  createdAt: t,
}

describe("S2 mapping: business rows → transactional events", () => {
  it("purchase: deterministic id, ids and whitelisted properties survive buildEventRow", () => {
    const ev = purchaseEvent(order)!
    expect(ev.eventId).toBe("purchase:ord_000001")
    const built = buildEventRow(ev, { analyticsConsent: false, now: new Date("2026-11-26T00:00:00Z") })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row).toMatchObject({
      eventClass: "transactional",
      eventType: "purchase",
      orderId: "ord_000001",
      productId: "prod_1",
      listingId: "ap_0000001",
      creatorId: "aff_000001",
      supplierId: "sup_000001",
      anonymousId: null,
      sessionId: null,
      channel: null,
      occurredAt: t,
    })
    expect(built.row.properties).toEqual({ amount_cents: 5_990, currency: "EUR", quantity: 2, stripe_session_id: "cs_test_1234567890" })
  })

  it("an order that never was paid is not a purchase", () => {
    for (const status of ["PENDING", "pending", "failed", "FAILED", "expired"]) expect(purchaseEvent({ ...order, status })).toBeNull()
    for (const status of ["paid", "preparing", "shipped", "delivered", "refunded"]) expect(purchaseEvent({ ...order, status })).not.toBeNull()
  })

  it("refund: keyed by the Stripe refund id, carries the product so refund rates can be measured", () => {
    const ev = refundEvent({
      stripeRefundId: "re_123456789",
      orderId: "ord_000001",
      amountCents: 2_995,
      reason: "requested_by_customer",
      createdAt: t,
      order: { productId: "prod_1", affiliateProductId: "ap_0000001", supplierId: "sup_000001", affiliateId: "aff_000001", currency: "EUR" },
    })
    expect(ev.eventId).toBe("refund:re_123456789")
    const built = buildEventRow(ev, { analyticsConsent: false, now: new Date("2026-11-26T00:00:00Z") })
    expect(built.ok && built.row.productId).toBe("prod_1")
    expect(built.ok && built.row.properties).toEqual({ amount_cents: 2_995, currency: "EUR", reason_code: "REQUESTED_BY_CUSTOMER" })
  })

  it("return: requested always, resolved only in a terminal state", () => {
    const base = {
      id: "ret_1",
      orderId: "ord_000001",
      reasonCode: "DEFECTIVE_OR_BROKEN",
      createdAt: t,
      updatedAt: new Date("2026-11-22T10:00:00Z"),
      refundedAt: null,
      order: { productId: "prod_1", supplierId: "sup_000001", affiliateId: "aff_000001" },
    }
    expect(returnEvents({ ...base, status: "IN_TRANSIT" }).map((e) => e.eventId)).toEqual(["return_requested:ret_1"])
    const resolved = returnEvents({ ...base, status: "REFUNDED" })
    expect(resolved.map((e) => e.eventId)).toEqual(["return_requested:ret_1", "return_resolved:ret_1"])
    expect(resolved[1]!.properties).toEqual({ outcome: "refunded", reason_code: "DEFECTIVE_OR_BROKEN" })
  })

  it("delivery, published review, listing", () => {
    expect(deliveryEvent({ id: "ord_000001", productId: "p", supplierId: "s", affiliateId: "a", deliveredAt: null })).toBeNull()
    expect(deliveryEvent({ id: "ord_000001", productId: "p", supplierId: "s", affiliateId: "a", deliveredAt: t })!.eventId).toBe("delivery:ord_000001")
    expect(reviewEvent({ id: "rev_1", productId: "p", orderId: null, rating: 5, status: "HIDDEN", createdAt: t })).toBeNull()
    expect(reviewEvent({ id: "rev_1", productId: "p", orderId: null, rating: 5, status: "PUBLISHED", createdAt: t })!.eventId).toBe("review_created:rev_1")
    expect(listingAddedEvent({ id: "ap_0000001", productId: "p", affiliateId: "a", createdAt: t }).eventId).toBe("creator_product_added:ap_0000001")
  })

  it("every mapped event passes the spine's own validation (no visitor id, no channel)", () => {
    const evs = [
      purchaseEvent(order)!,
      listingAddedEvent({ id: "ap_0000001", productId: "prod_1", affiliateId: "aff_000001", createdAt: t }),
      deliveryEvent({ id: "ord_000001", productId: "prod_1", supplierId: "sup_000001", affiliateId: "aff_000001", deliveredAt: t })!,
    ]
    for (const ev of evs) {
      const built = buildEventRow({ ...ev, anonymousId: "anon_x", sessionId: "s", channel: "paid_social" }, { analyticsConsent: false })
      expect(built.ok).toBe(true)
      if (built.ok) expect([built.row.anonymousId, built.row.sessionId, built.row.channel]).toEqual([null, null, null])
    }
  })
})

describe("smoothed refund rate (input of the net-margin guard)", () => {
  it("shrinks small samples towards the prior and lets large samples speak", () => {
    expect(smoothedRefundRate({ purchases: 0, refunds: 0, prior: 0.1 })).toBe(0.1)
    expect(smoothedRefundRate({ purchases: 1, refunds: 1, prior: 0.1 })).toBeCloseTo(3 / 21, 6) // not 100 %
    expect(smoothedRefundRate({ purchases: 1_000, refunds: 300, prior: 0.1 })).toBeCloseTo(302 / 1_020, 6)
    expect(smoothedRefundRate({ purchases: 5, refunds: 99, prior: 0.1 })).toBeCloseTo(7 / 25, 6) // refunds capped at purchases
  })
})

// ── Projector, against a mocked database ──────────────────────────────────────────────────────────────────────────
const db = vi.hoisted(() => ({
  orders: [] as Array<Record<string, unknown>>,
  failRefunds: false,
  written: new Map<string, unknown>(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => ("deliveredAt" in where ? [] : db.orders)),
    },
    orderStripeRefund: {
      findMany: vi.fn(async () => {
        if (db.failRefunds) throw new Error("refund table unreadable")
        return []
      }),
    },
    orderReturn: { findMany: vi.fn(async () => []) },
    review: { findMany: vi.fn(async () => []) },
    affiliateProduct: { findMany: vi.fn(async () => []) },
    affisellTrackEvent: {
      createMany: vi.fn(async ({ data }: { data: Array<{ eventId: string }> }) => {
        let count = 0
        for (const row of data) {
          if (db.written.has(row.eventId)) continue
          db.written.set(row.eventId, row)
          count++
        }
        return { count }
      }),
    },
  },
}))

describe("journal projector", () => {
  beforeEach(() => {
    db.orders = [order, { ...order, id: "ord_000002", status: "PENDING" }]
    db.failRefunds = false
    db.written.clear()
  })

  it("is off unless EVENTS_JOURNAL=on (merging and deploying changes nothing)", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const r = await projectBusinessJournal({ since: new Date(0), env: {} })
    expect(r.enabled).toBe(false)
    expect(db.written.size).toBe(0)
  })

  it("dry run maps and counts without writing", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const r = await projectBusinessJournal({ since: new Date(0), env: {}, dryRun: true, sources: ["purchase"] })
    expect(r.bySource.purchase).toMatchObject({ rows: 2, events: 1, written: 0 })
    expect(db.written.size).toBe(0)
  })

  it("writes once, and a re-run (overlapping window) writes nothing new", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const env = { EVENTS_JOURNAL: "on" }
    const first = await projectBusinessJournal({ since: new Date(0), env, sources: ["purchase"] })
    expect(first.bySource.purchase).toMatchObject({ events: 1, written: 1, duplicates: 0 })
    const again = await projectBusinessJournal({ since: new Date(0), env, sources: ["purchase"] })
    expect(again.bySource.purchase).toMatchObject({ events: 1, written: 0, duplicates: 1 })
    expect([...db.written.keys()]).toEqual(["purchase:ord_000001"])
  })

  it("a failing source is reported and the others still run; it never throws", async () => {
    db.failRefunds = true
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const r = await projectBusinessJournal({ since: new Date(0), env: { EVENTS_JOURNAL: "on" } })
    expect(r.bySource.refund?.error).toMatch(/unreadable/)
    expect(r.bySource.purchase?.written).toBe(1)
  })
})
