import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * S2 end-to-end validation, against an in-memory database: projection → reconciliation, then the failure modes the
 * activation checklist must catch (missing event, orphan, interrupted run, refund-rate drift).
 */
type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  orders: [] as Row[],
  refunds: [] as Row[],
  events: new Map<string, Row & { id: string }>(),
  failOnRefundCall: -1,
  refundCalls: 0,
}))

function inWindow(value: unknown, w: { gte: Date; lt: Date }) {
  return value instanceof Date && value >= w.gte && value < w.lt
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(async ({ where, skip = 0, take = 1_000 }: { where: Row; skip?: number; take?: number }) => {
        if ("deliveredAt" in where) return []
        const w = where.paidAt as { gte: Date; lt: Date }
        return db.orders
          .filter((o) => inWindow(o.paidAt, w))
          .sort((a, b) => +(a.paidAt as Date) - +(b.paidAt as Date) || String(a.id).localeCompare(String(b.id)))
          .slice(skip, skip + take)
      }),
    },
    orderStripeRefund: {
      findMany: vi.fn(async ({ where, skip = 0, take = 1_000 }: { where: Row; skip?: number; take?: number }) => {
        db.refundCalls += 1
        if (db.refundCalls === db.failOnRefundCall) throw new Error("connection reset")
        const w = where.createdAt as { gte: Date; lt: Date }
        return db.refunds.filter((r) => inWindow(r.createdAt, w)).slice(skip, skip + take)
      }),
    },
    orderReturn: { findMany: vi.fn(async () => []) },
    review: { findMany: vi.fn(async () => []) },
    affiliateProduct: { findMany: vi.fn(async () => []) },
    affisellTrackEvent: {
      createMany: vi.fn(async ({ data }: { data: Array<Row & { eventId: string }> }) => {
        let count = 0
        for (const row of data) {
          if (db.events.has(row.eventId)) continue
          db.events.set(row.eventId, { ...row, id: `ev_${String(db.events.size).padStart(8, "0")}` })
          count++
        }
        return { count }
      }),
      findMany: vi.fn(
        async ({ where, take = 1_000, cursor }: { where: Row; take?: number; cursor?: { id: string } }) => {
          const all = [...db.events.values()].sort((a, b) => a.id.localeCompare(b.id))
          if (where.eventId) {
            const ids = new Set((where.eventId as { in: string[] }).in)
            return all.filter((e) => ids.has(e.eventId as string)).map((e) => ({ eventId: e.eventId }))
          }
          const types = new Set((where.eventType as { in: string[] }).in)
          const w = where.occurredAt as { gte: Date; lt: Date }
          const rows = all.filter(
            (e) => e.eventClass === "transactional" && types.has(e.eventType as string) && inWindow(e.occurredAt, w),
          )
          const start = cursor ? rows.findIndex((e) => e.id === cursor.id) + 1 : 0
          return rows.slice(start, start + take)
        },
      ),
    },
  },
}))

const T0 = new Date("2026-10-01T00:00:00Z")
const since = new Date("2026-09-01T00:00:00Z")
const until = new Date("2026-11-01T00:00:00Z")
const env = { EVENTS_JOURNAL: "on" }
const SOURCES = ["purchase", "refund"] as const

function seed(nOrders: number, nRefunds: number) {
  db.orders = Array.from({ length: nOrders }, (_, i) => ({
    id: `ord_${String(i).padStart(6, "0")}`,
    productId: `prod_${String(i % 7).padStart(4, "0")}`,
    affiliateProductId: "ap_000001",
    supplierId: "sup_000001",
    affiliateId: "aff_000001",
    quantity: 1,
    totalCents: 4_900,
    currency: "eur",
    stripeSessionId: null,
    paidAt: new Date(T0.getTime() + i * 60_000),
  }))
  db.refunds = db.orders.slice(0, nRefunds).map((o, i) => ({
    stripeRefundId: `re_${String(i).padStart(8, "0")}`,
    orderId: o.id,
    amountCents: 4_900,
    reason: "requested_by_customer",
    createdAt: new Date(T0.getTime() + 86_400_000 + i * 60_000),
    order: {
      productId: o.productId,
      affiliateProductId: "ap_000001",
      supplierId: "sup_000001",
      affiliateId: "aff_000001",
      currency: "eur",
    },
  }))
}

describe("S2 validation — projection then reconciliation", () => {
  beforeEach(() => {
    db.events.clear()
    db.failOnRefundCall = -1
    db.refundCalls = 0
    seed(2_350, 140)
  })

  it("a complete projection reconciles exactly, refund rates included (2 350 orders over 3 pages)", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const { reconcileBusinessJournal } = await import("@/lib/events/journal-reconcile.server")
    await projectBusinessJournal({ since, until, env, sources: SOURCES })
    const r = await reconcileBusinessJournal({ since, until, sources: SOURCES })
    expect(r.bySource.purchase).toMatchObject({ expected: 2_350, present: 2_350, missing: 0, orphans: 0 })
    expect(r.bySource.refund).toMatchObject({ expected: 140, present: 140, missing: 0, orphans: 0 })
    expect(r.refundRates.productsCompared).toBe(7)
    expect(r.refundRates.maxAbsDiff).toBe(0)
    expect(r.consistent).toBe(true)
  })

  it("idempotence: a second projection writes nothing and the journal is unchanged", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    await projectBusinessJournal({ since, until, env, sources: SOURCES })
    const size = db.events.size
    const again = await projectBusinessJournal({ since, until, env, sources: SOURCES })
    expect(again.bySource.purchase).toMatchObject({ written: 0, duplicates: 2_350 })
    expect(db.events.size).toBe(size)
  })

  it("an interrupted run is detected, and re-running the same window completes it", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const { reconcileBusinessJournal } = await import("@/lib/events/journal-reconcile.server")
    db.failOnRefundCall = 1 // the refund source fails mid-run
    const first = await projectBusinessJournal({ since, until, env, sources: SOURCES })
    expect(first.bySource.refund?.error).toMatch(/connection reset/)
    const broken = await reconcileBusinessJournal({ since, until, sources: SOURCES })
    expect(broken.consistent).toBe(false)
    expect(broken.bySource.refund?.missing).toBe(140)
    // The guard would have read a WRONG refund rate: the check says so.
    expect(broken.refundRates.drifts.length).toBeGreaterThan(0)
    await projectBusinessJournal({ since, until, env, sources: SOURCES })
    const fixed = await reconcileBusinessJournal({ since, until, sources: SOURCES })
    expect(fixed.consistent).toBe(true)
  })

  it("reports a missing event and an orphan, with samples, and never writes", async () => {
    const { projectBusinessJournal } = await import("@/lib/events/journal-projector.server")
    const { reconcileBusinessJournal } = await import("@/lib/events/journal-reconcile.server")
    await projectBusinessJournal({ since, until, env, sources: SOURCES })
    db.events.delete("purchase:ord_000010")
    db.events.set("purchase:ord_ghost01", {
      id: "ev_zzzzzzzz",
      eventId: "purchase:ord_ghost01",
      eventType: "purchase",
      eventClass: "transactional",
      occurredAt: T0,
      productId: "prod_0000",
    })
    const size = db.events.size
    const r = await reconcileBusinessJournal({ since, until, sources: SOURCES })
    expect(r.bySource.purchase).toMatchObject({
      missing: 1,
      missingSample: ["purchase:ord_000010"],
      orphans: 1,
      orphanSample: ["purchase:ord_ghost01"],
    })
    expect(r.consistent).toBe(false)
    expect(db.events.size).toBe(size)
  })
})
