import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createFakePurchaseDb, type FakePurchaseDb } from "@/lib/fulfillment/__tests__/helpers/fake-purchase-db"
import { LOSS_MAKING_SALE, makeFakeOrder } from "@/lib/fulfillment/__tests__/helpers/order-fixtures"

const h = vi.hoisted(() => ({ db: null as unknown, sentry: [] as unknown[][], ops: [] as string[] }))

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_t, key) => (h.db as Record<string | symbol, unknown>)[key] }),
}))
vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: async (text: string) => {
    h.ops.push(text)
    return { slack: true, discord: false }
  },
}))
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => {
    h.sentry.push(args)
  },
}))

import {
  authorizeSupplierPurchase,
  markSupplierPurchasePlaced,
  releaseSupplierPurchase,
  reportInDoubtPurchase,
  reportStaleClaimIfOld,
  SUPPLIER_PURCHASE_LOCK_PREFIX,
} from "@/lib/fulfillment/supplier-purchase-guard"

let db: FakePurchaseDb
let clock = new Date("2026-11-13T12:00:00Z")

function setup(orderOver: Record<string, unknown> = {}, sale?: Parameters<typeof makeFakeOrder>[1]) {
  db = createFakePurchaseDb({ orders: [makeFakeOrder("o1", sale, orderOver)], now: () => clock })
  h.db = db.prisma
  return db
}

beforeEach(() => {
  clock = new Date("2026-11-13T12:00:00Z")
  h.sentry.length = 0
  h.ops.length = 0
  delete process.env.AUTO_BUY_MIN_MARGIN_CENTS
  setup()
})
afterEach(() => {
  delete process.env.AUTO_BUY_MIN_MARGIN_CENTS
})

const go = (path: "auto_buy" | "engine" | "order_paid" = "auto_buy") => authorizeSupplierPurchase({ orderId: "o1", path, now: clock })

describe("authorizeSupplierPurchase — exactly one caller gets to buy", () => {
  it("two simultaneous callers => ONE go, the other sees the claim in progress", async () => {
    const [a, b] = await Promise.all([go("auto_buy"), go("order_paid")])
    const kinds = [a.kind, b.kind].sort()
    expect(kinds).toEqual(["go", "in_progress"])
    expect(db.logs.get("o1")?.status).toBe("BUYING")
    expect(db.logs.get("o1")?.attempts).toBe(1)
  })

  it("twelve simultaneous callers over the three paths => still ONE go", async () => {
    const paths = ["auto_buy", "engine", "order_paid"] as const
    const verdicts = await Promise.all(Array.from({ length: 12 }, (_v, i) => go(paths[i % 3]!)))
    expect(verdicts.filter((v) => v.kind === "go")).toHaveLength(1)
    expect(verdicts.filter((v) => v.kind === "in_progress")).toHaveLength(11)
    expect(db.logs.get("o1")?.attempts).toBe(1)
  })

  it("the lock key is the ORDER, identical for every path", async () => {
    await go("auto_buy")
    await go("engine")
    await go("order_paid")
    expect(db.stats.lockKeys).toEqual(Array(3).fill(`${SUPPLIER_PURCHASE_LOCK_PREFIX}o1`))
  })

  it("different orders do not block each other", async () => {
    db = createFakePurchaseDb({ orders: [makeFakeOrder("o1"), makeFakeOrder("o2")], now: () => clock })
    h.db = db.prisma
    const [a, b] = await Promise.all([
      authorizeSupplierPurchase({ orderId: "o1", path: "auto_buy", now: clock }),
      authorizeSupplierPurchase({ orderId: "o2", path: "auto_buy", now: clock }),
    ])
    expect([a.kind, b.kind]).toEqual(["go", "go"])
  })
})

describe("authorizeSupplierPurchase — the claim's life cycle", () => {
  it("go writes the durable BUYING claim before anything is spent", async () => {
    const v = await go()
    expect(v).toMatchObject({ kind: "go", attempt: 1 })
    expect(db.logs.get("o1")).toMatchObject({ status: "BUYING", attempts: 1, orderItemId: "o1" })
  })

  it("after the supplier answered: BOUGHT => every later caller sees 'already placed'", async () => {
    await go()
    await markSupplierPurchasePlaced("o1", "AE-1001")
    expect(db.logs.get("o1")).toMatchObject({ status: "BOUGHT", aeOrderId: "AE-1001" })
    for (const path of ["auto_buy", "engine", "order_paid"] as const) {
      expect(await go(path)).toMatchObject({ kind: "already_placed", supplierOrderId: "AE-1001", evidence: "log" })
    }
  })

  it("after a DEFINITIVE refusal: FAILED => a retry may buy again (attempt 2)", async () => {
    await go()
    await releaseSupplierPurchase("o1", "AE_ORDER_REFUSED:INVENTORY_SHORTAGE")
    expect(db.logs.get("o1")).toMatchObject({ status: "FAILED", errorMsg: "AE_ORDER_REFUSED:INVENTORY_SHORTAGE" })
    expect(await go()).toMatchObject({ kind: "go", attempt: 2 })
  })

  it("LOST ANSWER: the claim is never recorded as bought nor released => nobody buys again, ever", async () => {
    expect((await go()).kind).toBe("go")
    // The process died / the supplier answer was lost. Replays at +1 min, +16 min, +1 day, +30 days:
    for (const minutes of [1, 16, 60 * 24, 60 * 24 * 30]) {
      clock = new Date(clock.getTime() + minutes * 60_000)
      const v = await go("order_paid")
      expect(v.kind).toBe("in_progress")
    }
    expect(db.logs.get("o1")?.status).toBe("BUYING")
    expect(db.logs.get("o1")?.attempts).toBe(1)
  })

  it("a STALE claim alerts a human and flags the order for manual handling (still no purchase)", async () => {
    await go()
    clock = new Date(clock.getTime() + 20 * 60_000)
    const v = await go("auto_buy")
    expect(v).toMatchObject({ kind: "in_progress", stale: true })
    expect(h.sentry).toHaveLength(1)
    expect(String((h.sentry[0]![0] as Error).message)).toContain("SUPPLIER_PURCHASE_IN_DOUBT:stale_claim")
    expect(db.orders.get("o1")?.fulfillmentStatus).toBe("MANUAL_REQUIRED")
  })

  it("a fresh in-progress replay is silent (no alert)", async () => {
    await go()
    await go()
    expect(h.sentry).toHaveLength(0)
  })
})

describe("authorizeSupplierPurchase — the state is re-read INSIDE the lock, from every source", () => {
  it("Order.supplierOrderId set by another path => already placed, no claim written", async () => {
    setup({ supplierOrderId: "AE-OTHER", status: "fulfilling" })
    expect(await go("engine")).toMatchObject({ kind: "already_placed", supplierOrderId: "AE-OTHER", evidence: "order" })
    expect(db.logs.has("o1")).toBe(false)
  })

  it("an engine job that already carries a supplier order id => already placed", async () => {
    setup()
    db.jobs.push({ id: "job1", supplierOrderId: "AE-JOB", status: "PROCESSING", orderIds: ["o1"] })
    expect(await go("auto_buy")).toMatchObject({ kind: "already_placed", supplierOrderId: "AE-JOB", evidence: "job" })
    expect(db.logs.has("o1")).toBe(false)
  })

  it("ONE engine job groups the cart's orders but buys only the first: the SECOND order is still purchasable (#1)", async () => {
    db = createFakePurchaseDb({
      orders: [makeFakeOrder("o1"), makeFakeOrder("o2")],
      jobs: [{ id: "job1", supplierOrderId: "AE-A", status: "PROCESSING", orderIds: ["o1", "o2"] }],
      now: () => clock,
    })
    h.db = db.prisma
    expect(await authorizeSupplierPurchase({ orderId: "o1", path: "engine", now: clock })).toMatchObject({
      kind: "already_placed",
      supplierOrderId: "AE-A",
      evidence: "job",
    })
    const second = await authorizeSupplierPurchase({ orderId: "o2", path: "order_paid", now: clock })
    expect(second).toMatchObject({ kind: "go", attempt: 1 })
    expect(db.logs.get("o2")?.status).toBe("BUYING")
    expect(db.logs.has("o1")).toBe(false)
  })

  it("a FAILED engine job does not block", async () => {
    setup()
    db.jobs.push({ id: "job1", supplierOrderId: null, status: "FAILED", orderIds: ["o1"] })
    expect((await go()).kind).toBe("go")
  })

  it.each(["refunded", "cancelled", "shipped"])("an order that is %s is not purchasable (no claim, no purchase)", async (status) => {
    setup({ status })
    expect(await go()).toMatchObject({ kind: "not_purchasable", orderStatus: status })
    expect(db.logs.has("o1")).toBe(false)
  })

  it("an unknown order is reported, not claimed", async () => {
    expect(await authorizeSupplierPurchase({ orderId: "ghost", path: "auto_buy", now: clock })).toEqual({
      kind: "order_not_found",
      orderId: "ghost",
    })
  })

  it("a purchase placed by ONE path while another waits at the lock: the waiter then sees it", async () => {
    // A takes the claim and finishes (bought); B was queued on the same lock and only evaluates afterwards.
    const a = go("auto_buy")
    const b = go("order_paid")
    const first = await a
    expect(first.kind).toBe("go")
    await markSupplierPurchasePlaced("o1", "AE-1")
    const second = await b
    expect(["in_progress", "already_placed"]).toContain(second.kind) // B ran after A's claim — never a second `go`
    expect((await go("engine")).kind).toBe("already_placed")
  })
})

describe("authorizeSupplierPurchase — margin gate (G3)", () => {
  it("a loss-making sale is refused BEFORE anything is claimed, with trace + alert + manual flag", async () => {
    setup({}, LOSS_MAKING_SALE)
    const v = await go("auto_buy")
    expect(v.kind).toBe("margin_refused")
    if (v.kind !== "margin_refused") return
    expect(v.decision.reason).toBe("margin_below_floor")
    expect(v.decision.marginCents).toBeLessThan(0)
    expect(db.logs.has("o1")).toBe(false) // no BUYING claim left behind
    expect(h.sentry).toHaveLength(1)
    expect(String((h.sentry[0]![0] as Error).message)).toMatch(/^MARGIN_REFUSED:margin_below_floor:margin=-\d+:floor=300$/)
    expect(db.orders.get("o1")).toMatchObject({ fulfillmentStatus: "MANUAL_REQUIRED" })
    expect(JSON.stringify(db.orders.get("o1")?.fulfillmentErrors)).toContain("MARGIN_REFUSED")
  })

  it("an unknown cost (no supplier link) is refused", async () => {
    const order = makeFakeOrder("o1")
    ;(order.product as { supplierLink: unknown }).supplierLink = null
    db = createFakePurchaseDb({ orders: [order], now: () => clock })
    h.db = db.prisma
    const v = await go("engine")
    expect(v).toMatchObject({ kind: "margin_refused", decision: { reason: "cost_unknown" } })
  })

  it("an unknown cost passed by the caller (price 0) is refused", async () => {
    const v = await authorizeSupplierPurchase({
      orderId: "o1",
      path: "auto_buy",
      cost: { aeUnitPriceCents: 0, aeShippingCents: 0 },
      now: clock,
    })
    expect(v).toMatchObject({ kind: "margin_refused", decision: { reason: "cost_unknown" } })
  })

  it("the caller's resolved cost wins over the link default", async () => {
    // Link says 500 c (profitable); the SKU actually bought costs 5 000 c (a loss).
    const v = await authorizeSupplierPurchase({
      orderId: "o1",
      path: "order_paid",
      cost: { aeUnitPriceCents: 5000, aeShippingCents: 0 },
      now: clock,
    })
    expect(v.kind).toBe("margin_refused")
  })

  it("AUTO_BUY_MIN_MARGIN_CENTS is honoured", async () => {
    process.env.AUTO_BUY_MIN_MARGIN_CENTS = "999999"
    expect((await go()).kind).toBe("margin_refused")
    process.env.AUTO_BUY_MIN_MARGIN_CENTS = "0"
    expect((await go()).kind).toBe("go")
  })

  it("'already placed' wins over a margin refusal (no alert noise on a finished order)", async () => {
    setup({ supplierOrderId: "AE-DONE" }, LOSS_MAKING_SALE)
    expect((await go()).kind).toBe("already_placed")
    expect(h.sentry).toHaveLength(0)
  })

  it("two simultaneous callers on a refused order are BOTH refused (never a go)", async () => {
    setup({}, LOSS_MAKING_SALE)
    const [a, b] = await Promise.all([go("auto_buy"), go("engine")])
    expect([a.kind, b.kind]).toEqual(["margin_refused", "margin_refused"])
    expect(db.logs.has("o1")).toBe(false)
  })
})

describe("alerts reach the ops channel, not only Sentry (the BullMQ worker never initialises Sentry)", () => {
  it("a margin refusal posts to the ops webhook, with the order id and the refusal", async () => {
    setup({}, LOSS_MAKING_SALE)
    await go("engine")
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]).toContain("o1")
    expect(h.ops[0]).toMatch(/MARGIN_REFUSED:margin_below_floor/)
  })

  it("an outcome in doubt posts to the ops webhook and says to check AliExpress BEFORE any retry or refund", async () => {
    await go()
    await reportInDoubtPurchase({ orderId: "o1", path: "auto_buy", reason: "supplier_outcome_uncertain", error: "Remote service error" })
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]).toContain("EN DOUTE")
    expect(h.ops[0]).toContain("AVANT toute relance")
  })

  it("a purchase placed but not recorded posts the AliExpress id: it is stored nowhere else", async () => {
    await go()
    ;(db.prisma.fulfillmentLog as { updateMany: unknown }).updateMany = async () => {
      throw new Error("db down")
    }
    await markSupplierPurchasePlaced("o1", "AE-777")
    expect(h.ops.some((t) => t.includes("AE-777"))).toBe(true)
  })

  it("a stale claim seen by the authorize path posts to the ops webhook", async () => {
    await go()
    clock = new Date(clock.getTime() + 20 * 60_000)
    await go("order_paid")
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]).toContain("stale_claim")
  })

  it("reportStaleClaimIfOld (the order.paid fast path): silent while fresh, alerts once old", async () => {
    await reportStaleClaimIfOld("o1", "order_paid", new Date(Date.now() - 60_000))
    expect(h.ops).toHaveLength(0)
    await reportStaleClaimIfOld("o1", "order_paid", null)
    expect(h.ops).toHaveLength(0)
    await reportStaleClaimIfOld("o1", "order_paid", new Date(Date.now() - 16 * 60_000))
    expect(h.ops).toHaveLength(1)
  })

  it("the manual-handling flag APPENDS to the order's earlier errors instead of erasing them", async () => {
    setup({ fulfillmentErrors: [{ supplier: "INVENTORY_SHORTAGE" }] })
    await reportInDoubtPurchase({ orderId: "o1", path: "engine", reason: "supplier_outcome_uncertain" })
    const errors = db.orders.get("o1")?.fulfillmentErrors as Array<Record<string, string>>
    expect(errors).toHaveLength(2)
    expect(errors[0]).toEqual({ supplier: "INVENTORY_SHORTAGE" })
    expect(errors[1]).toMatchObject({ purchase_in_doubt: "supplier_outcome_uncertain" })
  })
})

describe("releaseSupplierPurchase is conditional (#2)", () => {
  it("releases only a BUYING claim: a log another path already settled is left alone", async () => {
    await go()
    await markSupplierPurchasePlaced("o1", "AE-1")
    await releaseSupplierPurchase("o1", "late definitive failure of a stale caller")
    expect(db.logs.get("o1")).toMatchObject({ status: "BOUGHT", aeOrderId: "AE-1" })
  })
})

describe("never-throwing helpers", () => {
  it("markSupplierPurchasePlaced alerts instead of throwing when the write fails (the purchase happened)", async () => {
    await go()
    ;(db.prisma.fulfillmentLog as { updateMany: unknown }).updateMany = async () => {
      throw new Error("db down")
    }
    await expect(markSupplierPurchasePlaced("o1", "AE-LOST")).resolves.toBeUndefined()
    expect(h.sentry.length).toBeGreaterThan(0)
    expect(JSON.stringify(h.sentry[0]![1])).toContain("AE-LOST") // the id reaches the alert: it is stored nowhere else
    expect(db.logs.get("o1")?.status).toBe("BUYING") // the claim keeps blocking
  })

  it("releaseSupplierPurchase never throws; a failed release keeps the claim", async () => {
    await go()
    ;(db.prisma.fulfillmentLog as { updateMany: unknown }).updateMany = async () => {
      throw new Error("db down")
    }
    await expect(releaseSupplierPurchase("o1", "x")).resolves.toBeUndefined()
    expect(db.logs.get("o1")?.status).toBe("BUYING")
  })

  it("reportInDoubtPurchase never throws", async () => {
    ;(db.prisma.order as { update: unknown }).update = async () => {
      throw new Error("db down")
    }
    await expect(
      reportInDoubtPurchase({ orderId: "o1", path: "engine", reason: "supplier_outcome_uncertain" })
    ).resolves.toBeUndefined()
  })
})
