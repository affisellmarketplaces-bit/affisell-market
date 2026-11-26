/**
 * The human way out of a purchase in doubt: explicit, serialised with the gate, audited — and it buys nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFakePurchaseDb, type FakeLog, type FakePurchaseDb } from "@/lib/fulfillment/__tests__/helpers/fake-purchase-db"
import { makeFakeOrder } from "@/lib/fulfillment/__tests__/helpers/order-fixtures"

const h = vi.hoisted(() => ({ db: null as unknown, released: [] as string[] }))

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_t, key) => (h.db as Record<string | symbol, unknown>)[key] }),
}))
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async () => ({ slack: false, discord: false }) }))
vi.mock("@/lib/trigger-order-transfer-release", () => ({
  triggerOrderTransferRelease: (orderId: string) => void h.released.push(orderId),
}))

import { reconcileInDoubtPurchase } from "@/lib/admin/auto-fulfill/reconcile-in-doubt-purchase"
import { authorizeSupplierPurchase, SUPPLIER_PURCHASE_LOCK_PREFIX } from "@/lib/fulfillment/supplier-purchase-guard"

let db: FakePurchaseDb
const clock = new Date("2026-11-13T12:00:00Z")

const buying = (): FakeLog => ({
  id: "log1",
  orderId: "o1",
  orderItemId: "o1",
  status: "BUYING",
  aeOrderId: null,
  aeTracking: null,
  virtualCardId: null,
  errorMsg: "OUTCOME_UNCERTAIN:Remote service error",
  attempts: 1,
  createdAt: new Date(clock.getTime() - 3_600_000),
  updatedAt: new Date(clock.getTime() - 3_600_000),
})

function setup(orderOver: Record<string, unknown> = {}, logs: FakeLog[] = [buying()]) {
  db = createFakePurchaseDb({ orders: [makeFakeOrder("o1", undefined, orderOver)], logs, now: () => clock })
  h.db = db.prisma
}

beforeEach(() => {
  h.released.length = 0
  setup()
})

const reconcile = (over: Record<string, unknown> = {}) =>
  reconcileInDoubtPurchase({ orderId: "o1", outcome: "exists", supplierOrderId: "8123456789012", actorId: "admin1", ...over } as never)

describe("reconcileInDoubtPurchase — the order EXISTS at AliExpress", () => {
  it("records it exactly like a purchase: log BOUGHT, Order.supplierOrderId, fulfilling — and every path then answers 'already placed'", async () => {
    expect(await reconcile()).toMatchObject({ ok: true, outcome: "exists", orderId: "o1" })
    expect(db.logs.get("o1")).toMatchObject({ status: "BOUGHT", aeOrderId: "8123456789012", errorMsg: null })
    expect(db.orders.get("o1")).toMatchObject({ supplierOrderId: "8123456789012", status: "fulfilling", fulfillmentStatus: "ORDERED" })
    for (const path of ["auto_buy", "engine", "order_paid"] as const) {
      expect(await authorizeSupplierPurchase({ orderId: "o1", path, now: clock })).toMatchObject({ kind: "already_placed" })
    }
    expect(h.released).toEqual(["o1"]) // the supplier transfer may have been waiting for "upstream funded"
  })

  it("is AUDITED: who, what, which AliExpress id, why", async () => {
    await reconcile({ note: "seen in the AliExpress order list" })
    expect(db.audits).toHaveLength(1)
    expect(db.audits[0]).toMatchObject({
      action: "auto_buy.reconcile_in_doubt",
      entityType: "order",
      entityId: "o1",
      actorId: "admin1",
      payload: { outcome: "exists", supplierOrderId: "8123456789012", note: "seen in the AliExpress order list", previousStatus: "BUYING" },
    })
  })

  it.each([undefined, "", "   ", "abc", "DRY_RUN_12345678", "has space 123456", "x".repeat(41)])(
    "refuses a missing / malformed AliExpress id (%s) and changes nothing",
    async (supplierOrderId) => {
      expect(await reconcile({ supplierOrderId })).toEqual({ ok: false, error: "supplier_order_id_required", status: 400 })
      expect(db.logs.get("o1")?.status).toBe("BUYING")
      expect(db.audits).toHaveLength(0)
    }
  )

  it("refuses when the order already carries ANOTHER supplier order id (409)", async () => {
    setup({ supplierOrderId: "9999999999999" })
    expect(await reconcile()).toEqual({ ok: false, error: "order_has_another_supplier_order_id", status: 409 })
    expect(db.logs.get("o1")?.status).toBe("BUYING")
  })

  it("a refunded order keeps its status: only the supplier reference is recorded", async () => {
    setup({ status: "refunded" })
    expect(await reconcile()).toMatchObject({ ok: true })
    expect(db.orders.get("o1")).toMatchObject({ status: "refunded", supplierOrderId: "8123456789012" })
  })
})

describe("reconcileInDoubtPurchase — the order does NOT exist", () => {
  it("releases the claim: log FAILED with the trace, and a retry may buy (attempt 2)", async () => {
    expect(await reconcile({ outcome: "not_exists", supplierOrderId: undefined, note: "not in the list" })).toMatchObject({ ok: true, outcome: "not_exists" })
    expect(db.logs.get("o1")).toMatchObject({ status: "FAILED", errorMsg: "RECONCILED_NOT_BOUGHT:not in the list" })
    expect(db.orders.get("o1")?.supplierOrderId).toBeNull()
    expect(await authorizeSupplierPurchase({ orderId: "o1", path: "order_paid", now: clock })).toMatchObject({ kind: "go", attempt: 2 })
    expect(db.audits[0]).toMatchObject({ payload: { outcome: "not_exists", supplierOrderId: null } })
    expect(h.released).toEqual([])
  })
})

describe("reconcileInDoubtPurchase — guards", () => {
  it.each(["PENDING", "FAILED", "BOUGHT", "REFUNDED"] as const)("a log that is %s is not in doubt: 409, nothing changes, no audit", async (status) => {
    setup({}, [{ ...buying(), status }])
    expect(await reconcile()).toEqual({ ok: false, error: "not_in_doubt", status: 409 })
    expect(db.logs.get("o1")?.status).toBe(status)
    expect(db.audits).toHaveLength(0)
  })

  it("an order with no log is not in doubt", async () => {
    setup({}, [])
    expect(await reconcile()).toEqual({ ok: false, error: "not_in_doubt", status: 409 })
  })

  it("an unknown order is 404", async () => {
    expect(await reconcile({ orderId: "ghost" })).toEqual({ ok: false, error: "order_not_found", status: 404 })
  })

  it("an invalid outcome is refused", async () => {
    expect(await reconcile({ outcome: "maybe" })).toEqual({ ok: false, error: "invalid_outcome", status: 400 })
  })

  it("takes the SAME per-order lock as the purchase gate, so no purchase can be claimed while a person decides", async () => {
    await reconcile({ outcome: "not_exists", supplierOrderId: undefined })
    expect(db.stats.lockKeys).toEqual([`${SUPPLIER_PURCHASE_LOCK_PREFIX}o1`])
  })

  it("two simultaneous reconciliations: ONE wins, the other finds the log no longer in doubt", async () => {
    const [a, b] = await Promise.all([reconcile(), reconcile({ outcome: "not_exists", supplierOrderId: undefined })])
    const oks = [a, b].filter((r) => r.ok)
    expect(oks).toHaveLength(1)
    expect([a, b].find((r) => !r.ok)).toMatchObject({ error: "not_in_doubt" })
    expect(db.audits).toHaveLength(1)
  })
})
