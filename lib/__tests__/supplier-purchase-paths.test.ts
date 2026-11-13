/**
 * G2 — the THREE AliExpress paths against ONE in-memory database, with the AliExpress call mocked (nothing real is ever
 * contacted, nothing real is ever bought):
 *
 *   1. auto-buy        `processAutoBuyFulfillmentLog`            (lib/fulfillment/auto-buy.ts)
 *   2. order.paid      `fulfillAffisellOrderWithAliExpress`      (lib/aliexpress-fulfill-order.ts — also the manual route)
 *   3. generic engine  `placeOrderViaSupplierAdapter`            (lib/suppliers/place-order-bridge.ts, real AE adapter)
 *
 * The assertion that matters is always the same: however many of them run at once, replay, or lose the supplier's answer,
 * the number of times the AliExpress call is made is ONE.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createFakePurchaseDb, type FakeLog, type FakePurchaseDb } from "@/lib/fulfillment/__tests__/helpers/fake-purchase-db"
import { LOSS_MAKING_SALE, makeFakeOrder } from "@/lib/fulfillment/__tests__/helpers/order-fixtures"

const h = vi.hoisted(() => ({
  db: null as unknown,
  sentry: [] as unknown[][],
  ae: { calls: 0, placed: [] as string[], mode: "ok" as "ok" | "uncertain" | "refused", delayMs: 15 },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === "fulfillmentProvider") {
          return {
            findUnique: async () => ({
              id: "prov1",
              slug: "aliexpress",
              name: "AliExpress",
              channelType: "ALIEXPRESS",
              status: "ACTIVE",
              apiConfig: null,
              credentialsEncrypted: null,
              blindDropshipSupplier: null,
            }),
          }
        }
        return (h.db as Record<string | symbol, unknown>)[key]
      },
    }
  ),
}))
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => {
    h.sentry.push(args)
  },
}))

async function fakeAeCall() {
  h.ae.calls += 1
  await new Promise((r) => setTimeout(r, h.ae.delayMs))
  if (h.ae.mode === "uncertain") {
    return { ok: false as const, error: "AliExpress API request timed out", outcomeUncertain: true, methodAttempts: [] as string[] }
  }
  if (h.ae.mode === "refused") {
    return { ok: false as const, error: "INVENTORY_SHORTAGE", methodAttempts: [] as string[] }
  }
  const id = `AE-${h.ae.placed.length + 1}`
  h.ae.placed.push(id)
  return { ok: true as const, id }
}

vi.mock("@/lib/aliexpress-ds-create-order", () => ({
  createAliExpressDsOrder: async () => {
    const r = await fakeAeCall()
    return r.ok
      ? { ok: true, aliexpressOrderId: r.id, trackingPreview: null, method: "mock" }
      : { ok: false, error: r.error, methodAttempts: [], ...(r.outcomeUncertain ? { outcomeUncertain: true } : {}) }
  },
  placeAliExpressDsOrder: async () => {
    const r = await fakeAeCall()
    return r.ok
      ? { ok: true, aeOrderId: r.id }
      : { ok: false, error: r.error, ...(r.outcomeUncertain ? { outcomeUncertain: true } : {}) }
  },
}))
vi.mock("@/lib/fulfillment/bullmq/auto-buy.queue", () => ({ enqueueAutoBuyJob: vi.fn(async () => undefined) }))
vi.mock("@/lib/fulfillment/rate-limit", () => ({ acquireAutoBuyRateLimit: async () => ({ ok: true }) }))
vi.mock("@/lib/fulfillment/stripe-issuing-card", () => ({
  autoBuyCardAmountCents: (price: number, shipping: number) => Math.max(100, price + shipping + 100),
  createAutoBuyVirtualCard: async () => ({
    ok: true,
    cardId: "ic_test",
    last4: "0005",
    number: "test-card-number",
    expMonth: 1,
    expYear: 2030,
    cvc: "000",
  }),
  freezeAutoBuyVirtualCard: vi.fn(async () => undefined),
  loadAutoBuyVirtualCardSecrets: async () => ({ ok: false, error: "none" }),
}))
vi.mock("@/lib/marketplace-refund-pipeline", () => ({ initiateMarketplaceRefundPipeline: vi.fn(async () => ({ ok: true })) }))
vi.mock("@/lib/emails/notify-order-cancelled", () => ({ notifyOrderCancelled: vi.fn(async () => undefined) }))
vi.mock("@/lib/trigger-order-transfer-release", () => ({ triggerOrderTransferRelease: vi.fn() }))
vi.mock("@/lib/suppliers/factory", async () => {
  const { AliExpressSupplierAdapter } = await import("@/lib/suppliers/adapters/aliexpress.adapter")
  return {
    createSupplierAdapter: () =>
      new AliExpressSupplierAdapter({
        id: "prov1",
        slug: "aliexpress",
        name: "AliExpress",
        channelType: "ALIEXPRESS",
        apiConfig: null,
        credentialsEncrypted: null,
      } as never),
    fulfillmentProviderToContext: () => ({}),
  }
})

import { fulfillAffisellOrderWithAliExpress } from "@/lib/aliexpress-fulfill-order"
import { processAutoBuyFulfillmentLog } from "@/lib/fulfillment/auto-buy"
import { placeOrderViaSupplierAdapter } from "@/lib/suppliers/place-order-bridge"
import type { PlaceSupplierOrderInput } from "@/lib/auto-order/types"

let db: FakePurchaseDb
let clock = new Date("2026-11-13T12:00:00Z")

const pendingLog = (): FakeLog => ({
  id: "log1",
  orderId: "o1",
  orderItemId: "o1",
  status: "PENDING",
  aeOrderId: null,
  aeTracking: null,
  virtualCardId: null,
  errorMsg: null,
  attempts: 0,
  createdAt: clock,
  updatedAt: clock,
})

function setup(sale?: Parameters<typeof makeFakeOrder>[1]) {
  db = createFakePurchaseDb({ orders: [makeFakeOrder("o1", sale)], logs: [pendingLog()], now: () => clock })
  h.db = db.prisma
}

const engineInput: PlaceSupplierOrderInput = {
  batchId: "batch1",
  reference: "afb-batch1-job1",
  shipping: { name: "Test Buyer", line1: "1 rue de la Paix", city: "Paris", postal_code: "75001", country: "FR", phone: "33612345678" },
  contactEmail: "buyer@example.test",
  group: {
    providerId: "prov1",
    channel: "ALIEXPRESS",
    paymentMethod: "INVOICE_NET30",
    totalCostCents: 3000,
    lines: [
      {
        orderId: "o1",
        productId: "1005007291234567",
        productName: "Test product",
        quantity: 1,
        unitCostCents: 3000,
        unitPriceCents: 9000,
        supplierSku: "12000012345678901",
        variantLabel: null,
        channel: "ALIEXPRESS",
        providerId: "prov1",
      },
    ],
  },
}

const autoBuy = () => processAutoBuyFulfillmentLog("log1")
const orderPaid = () => fulfillAffisellOrderWithAliExpress("o1")
const engine = () => placeOrderViaSupplierAdapter(engineInput)

beforeEach(() => {
  vi.stubEnv("AUTO_BUY_ENABLED", "true")
  vi.stubEnv("DISABLE_AUTO_BUY", "")
  vi.stubEnv("AUTO_ORDER_ENABLED", "")
  vi.stubEnv("AE_DRY_RUN", "false")
  vi.stubEnv("AUTO_BUY_MIN_MARGIN_CENTS", "")
  clock = new Date("2026-11-13T12:00:00Z")
  h.sentry.length = 0
  h.ae.calls = 0
  h.ae.placed = []
  h.ae.mode = "ok"
  h.ae.delayMs = 15
  setup()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("G2 — concurrent triggers never buy twice", () => {
  it("all three paths at once => ONE AliExpress call", async () => {
    const results = await Promise.all([autoBuy(), orderPaid(), engine()])
    expect(h.ae.calls).toBe(1)
    expect(h.ae.placed).toHaveLength(1)
    // exactly one of the three bought; the two others were refused or short-circuited
    const engineResult = results[2]
    const fulfillResult = results[1]
    const boughtBy = [
      db.logs.get("o1")?.status === "BOUGHT",
      engineResult.supplierOrderId != null,
      fulfillResult.ok && !fulfillResult.alreadyFulfilled,
    ].filter(Boolean).length
    expect(boughtBy).toBeGreaterThanOrEqual(1)
    expect(db.logs.get("o1")?.status).toBe("BOUGHT")
    expect(db.logs.get("o1")?.aeOrderId).toBe(h.ae.placed[0])
  })

  it.each([
    ["auto-buy + order.paid", () => [autoBuy(), orderPaid()]],
    ["auto-buy + engine", () => [autoBuy(), engine()]],
    ["order.paid + engine", () => [orderPaid(), engine()]],
    ["order.paid + order.paid (Inngest retry racing the manual route)", () => [orderPaid(), orderPaid()]],
    ["auto-buy + auto-buy (BullMQ duplicate job)", () => [autoBuy(), autoBuy()]],
    ["engine + engine (two batches for the same session)", () => [engine(), engine()]],
  ])("%s => ONE AliExpress call", async (_label, start) => {
    await Promise.all(start())
    expect(h.ae.calls).toBe(1)
  })

  it("five of each path at once (15 callers) => ONE AliExpress call", async () => {
    await Promise.all([
      ...Array.from({ length: 5 }, () => autoBuy()),
      ...Array.from({ length: 5 }, () => orderPaid()),
      ...Array.from({ length: 5 }, () => engine()),
    ])
    expect(h.ae.calls).toBe(1)
  })

  it("replays after the purchase never buy again, on any path", async () => {
    await orderPaid()
    expect(h.ae.calls).toBe(1)
    await autoBuy()
    await orderPaid()
    const e = await engine()
    expect(h.ae.calls).toBe(1)
    expect(e.status).toBe("CANCELLED")
    expect(e.errorMessage).toContain("duplicate_purchase_prevented")
  })

  it("the generic engine buys first => its claim becomes BOUGHT, so the two other paths find it and buy nothing", async () => {
    const e = await engine()
    expect(e).toMatchObject({ status: "PROCESSING", supplierOrderId: "AE-1" })
    expect(db.logs.get("o1")).toMatchObject({ status: "BOUGHT", aeOrderId: "AE-1" })
    await autoBuy()
    expect(await orderPaid()).toMatchObject({ ok: true, alreadyFulfilled: true, aliexpressOrderId: "AE-1" })
    expect(h.ae.calls).toBe(1)
    // order.paid also mirrors the id onto the order, so every later reader sees it
    expect(db.orders.get("o1")?.supplierOrderId).toBe("AE-1")
  })

  it("the refused engine duplicate is a CANCELLED job: it carries no supplier order id (the column is unique)", async () => {
    await autoBuy()
    const e = await engine()
    expect(e).toMatchObject({ supplierOrderId: null, status: "CANCELLED" })
  })
})

describe("G2 — a lost supplier answer never becomes a second purchase", () => {
  it("auto-buy: outcome unknown => claim kept, human alerted, NO browser fallback, NO retry, nobody buys again", async () => {
    h.ae.mode = "uncertain"
    await autoBuy()
    expect(h.ae.calls).toBe(1)
    expect(db.logs.get("o1")?.status).toBe("BUYING")
    expect(db.logs.get("o1")?.errorMsg).toContain("OUTCOME_UNCERTAIN")
    expect(db.orders.get("o1")?.fulfillmentStatus).toBe("MANUAL_REQUIRED")
    expect(h.sentry.some((c) => String((c[0] as Error).message).includes("SUPPLIER_PURCHASE_IN_DOUBT:supplier_outcome_uncertain"))).toBe(true)

    // The supplier recovers; every trigger replays — still nothing is bought.
    h.ae.mode = "ok"
    clock = new Date(clock.getTime() + 3 * 60 * 60_000)
    await autoBuy()
    const paid = await orderPaid()
    const e = await engine()
    expect(h.ae.calls).toBe(1)
    expect(paid).toMatchObject({ ok: false, error: "fulfillment_in_progress" })
    expect(e.status).toBe("CANCELLED")
    expect(db.logs.get("o1")?.status).toBe("BUYING")
  })

  it("order.paid: outcome unknown => `supplier_outcome_uncertain`, claim kept, replays buy nothing", async () => {
    h.ae.mode = "uncertain"
    expect(await orderPaid()).toMatchObject({ ok: false, error: "supplier_outcome_uncertain" })
    h.ae.mode = "ok"
    expect(await orderPaid()).toMatchObject({ ok: false, error: "fulfillment_in_progress" })
    await autoBuy()
    await engine()
    expect(h.ae.calls).toBe(1)
  })

  it("engine: outcome unknown => FAILED job flagged `supplier_outcome_uncertain`, claim kept, replays buy nothing", async () => {
    h.ae.mode = "uncertain"
    const first = await engine()
    expect(first).toMatchObject({ status: "FAILED", errorMessage: "supplier_outcome_uncertain", supplierOrderId: null })
    h.ae.mode = "ok"
    expect((await engine()).status).toBe("CANCELLED")
    await autoBuy()
    await orderPaid()
    expect(h.ae.calls).toBe(1)
  })

  it("a DEFINITIVE refusal frees the claim: the next attempt may buy (and only once)", async () => {
    h.ae.mode = "refused"
    expect(await orderPaid()).toMatchObject({ ok: false, error: "INVENTORY_SHORTAGE" })
    expect(db.logs.get("o1")?.status).toBe("FAILED")
    h.ae.mode = "ok"
    const [a, b] = await Promise.all([orderPaid(), engine()])
    expect(h.ae.placed).toHaveLength(1)
    expect(a.ok || b.supplierOrderId != null).toBe(true)
  })

  it("the success record fails AFTER the purchase: claim kept (no second purchase) and the AE id reaches the alert", async () => {
    // Make the post-purchase transaction fail, as a database blip would.
    const original = (db.prisma as unknown as { $transaction: (cb: unknown, o?: unknown) => Promise<unknown> }).$transaction
    let txCount = 0
    ;(db.prisma as unknown as { $transaction: unknown }).$transaction = (cb: unknown, o?: unknown) => {
      txCount += 1
      if (txCount === 2) return Promise.reject(new Error("db blip")) // 1st = the claim, 2nd = recording the purchase
      return original(cb, o)
    }
    const r = await orderPaid()
    expect(r).toMatchObject({ ok: false, error: "supplier_order_unrecorded" })
    expect(h.sentry.some((c) => JSON.stringify(c[1]).includes("AE-1"))).toBe(true)
    ;(db.prisma as unknown as { $transaction: unknown }).$transaction = original
    expect(await orderPaid()).toMatchObject({ ok: false, error: "fulfillment_in_progress" })
    await autoBuy()
    await engine()
    expect(h.ae.calls).toBe(1)
  })
})

describe("G2 — the claim follows the real outcome on the engine path", () => {
  it("a DEFINITIVE refusal on the engine path frees the claim: a later attempt buys, once", async () => {
    h.ae.mode = "refused"
    const refused = await engine()
    expect(refused).toMatchObject({ status: "FAILED", errorMessage: "INVENTORY_SHORTAGE" })
    expect(db.logs.get("o1")?.status).toBe("FAILED")
    h.ae.mode = "ok"
    const [a, b] = await Promise.all([engine(), engine()])
    expect(h.ae.placed).toHaveLength(1)
    expect([a.supplierOrderId, b.supplierOrderId].filter(Boolean)).toEqual(["AE-1"])
  })
})

describe("G2 — auto-buy keeps a claim that is in doubt, and still counts its attempts", () => {
  const unmatchedVariant = () => {
    const order = makeFakeOrder("o1", undefined, { variantLabel: "Red · M" })
    ;(order.product as { supplierLink: { variantMappings: unknown[] } }).supplierLink.variantMappings = [
      { id: "m1", productVariantId: null, matchColor: "Blue", matchSize: null, aeSkuId: "999", aePriceCents: 500, aeShippingCents: 100, aeLabel: "Blue" },
    ]
    return order
  }

  it("a replay of a BUYING log is read-only: a late SKU failure must not overwrite the claim with FAILED", async () => {
    db = createFakePurchaseDb({ orders: [unmatchedVariant()], logs: [{ ...pendingLog(), status: "BUYING", attempts: 1 }], now: () => clock })
    h.db = db.prisma
    await autoBuy()
    expect(db.logs.get("o1")?.status).toBe("BUYING")
    expect(db.logs.get("o1")?.attempts).toBe(1)
    expect(h.ae.calls).toBe(0)
    // ...and the claim still blocks everyone else
    expect(await orderPaid()).toMatchObject({ ok: false, error: "fulfillment_in_progress" })
    expect(h.ae.calls).toBe(0)
  })

  it("a purchase the engine recorded only on its job (not yet on the order) is found: the log mirrors it, nothing is bought", async () => {
    db = createFakePurchaseDb({
      orders: [makeFakeOrder("o1")],
      logs: [pendingLog()],
      jobs: [{ id: "job1", supplierOrderId: "AE-JOB", status: "PROCESSING", orderIds: ["o1"] }],
      now: () => clock,
    })
    h.db = db.prisma
    await autoBuy()
    expect(h.ae.calls).toBe(0)
    expect(db.logs.get("o1")).toMatchObject({ status: "BOUGHT", aeOrderId: "AE-JOB" })
  })

  it("an order refunded between the trigger and the run is not bought: log FAILED, no AliExpress call, no refund, no retry", async () => {
    const { enqueueAutoBuyJob } = await import("@/lib/fulfillment/bullmq/auto-buy.queue")
    const { initiateMarketplaceRefundPipeline } = await import("@/lib/marketplace-refund-pipeline")
    vi.mocked(enqueueAutoBuyJob).mockClear()
    vi.mocked(initiateMarketplaceRefundPipeline).mockClear()
    db = createFakePurchaseDb({ orders: [makeFakeOrder("o1", undefined, { status: "refunded" })], logs: [pendingLog()], now: () => clock })
    h.db = db.prisma
    await autoBuy()
    expect(h.ae.calls).toBe(0)
    expect(db.logs.get("o1")).toMatchObject({ status: "FAILED", errorMsg: "ORDER_NOT_PURCHASABLE:order_status:refunded" })
    expect(enqueueAutoBuyJob).not.toHaveBeenCalled()
    expect(initiateMarketplaceRefundPipeline).not.toHaveBeenCalled()
  })

  it("attempts are persisted when a run fails BEFORE the claim (no endless retry): the third failure refunds", async () => {
    const { enqueueAutoBuyJob } = await import("@/lib/fulfillment/bullmq/auto-buy.queue")
    const { initiateMarketplaceRefundPipeline } = await import("@/lib/marketplace-refund-pipeline")
    vi.mocked(enqueueAutoBuyJob).mockClear()
    vi.mocked(initiateMarketplaceRefundPipeline).mockClear()
    db = createFakePurchaseDb({ orders: [unmatchedVariant()], logs: [pendingLog()], now: () => clock })
    h.db = db.prisma

    await autoBuy()
    expect(db.logs.get("o1")).toMatchObject({ status: "FAILED", attempts: 1 })
    await autoBuy()
    expect(db.logs.get("o1")).toMatchObject({ status: "FAILED", attempts: 2 })
    expect(enqueueAutoBuyJob).toHaveBeenCalledTimes(2) // retries scheduled
    expect(initiateMarketplaceRefundPipeline).not.toHaveBeenCalled()
    await autoBuy()
    expect(db.logs.get("o1")).toMatchObject({ status: "REFUNDED", attempts: 3 })
    expect(initiateMarketplaceRefundPipeline).toHaveBeenCalledTimes(1)
    expect(h.ae.calls).toBe(0)
  })
})

describe("G3 — a refused margin never reaches AliExpress, on any path", () => {
  beforeEach(() => setup(LOSS_MAKING_SALE))

  it("auto-buy: log FAILED with the refusal, no retry, no refund, no AliExpress call", async () => {
    await autoBuy()
    expect(h.ae.calls).toBe(0)
    expect(db.logs.get("o1")?.status).toBe("FAILED")
    expect(db.logs.get("o1")?.errorMsg).toMatch(/^MARGIN_REFUSED:margin_below_floor:margin=-\d+:floor=300$/)
    expect(db.orders.get("o1")?.fulfillmentStatus).toBe("MANUAL_REQUIRED")
    expect(h.sentry.length).toBeGreaterThan(0)
  })

  it("order.paid: `margin_refused:<reason>`, no AliExpress call", async () => {
    expect(await orderPaid()).toMatchObject({ ok: false, error: "margin_refused:margin_below_floor" })
    expect(h.ae.calls).toBe(0)
  })

  it("engine: FAILED job `margin_refused:<reason>` (non-retryable), no AliExpress call", async () => {
    const r = await engine()
    expect(r).toMatchObject({ status: "FAILED", errorMessage: "margin_refused:margin_below_floor" })
    expect(h.ae.calls).toBe(0)
  })

  it("an unknown cost (price 0 on the supplier link) is refused on all three paths", async () => {
    const order = makeFakeOrder("o1")
    ;(order.product as { supplierLink: { aePriceCents: number } }).supplierLink.aePriceCents = 0
    db = createFakePurchaseDb({ orders: [order], logs: [pendingLog()], now: () => clock })
    h.db = db.prisma
    await autoBuy()
    expect(await orderPaid()).toMatchObject({ ok: false, error: "margin_refused:cost_unknown" })
    expect((await engine()).errorMessage).toBe("margin_refused:cost_unknown")
    expect(h.ae.calls).toBe(0)
  })

  it("a margin refusal is NON-RETRYABLE for the place-order queue (retrying cannot change the sale's economics)", async () => {
    const { isNonRetryablePlaceOrderError } = await import("@/lib/suppliers/place-order-errors")
    expect(isNonRetryablePlaceOrderError(new Error("margin_refused:margin_below_floor"))).toBe(true)
    expect(isNonRetryablePlaceOrderError(new Error("supplier_outcome_uncertain"))).toBe(false)
  })

  it("lowering the floor does NOT let a loss through (a negative margin is always refused)", async () => {
    vi.stubEnv("AUTO_BUY_MIN_MARGIN_CENTS", "0")
    await Promise.all([autoBuy(), orderPaid(), engine()])
    expect(h.ae.calls).toBe(0)
  })
})
