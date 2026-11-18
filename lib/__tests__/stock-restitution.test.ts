import { beforeEach, describe, expect, it, vi } from "vitest"

import { planStockRestitution } from "@/lib/checkout-stock"
import {
  buildStockReservedAuditRow,
  evaluateStockRestitution,
  parseStockReservationPayload,
  stockRestoredAuditId,
} from "@/lib/stock-restitution"

describe("planStockRestitution", () => {
  it("adds the units back to a product-level stock", () => {
    expect(planStockRestitution({ stock: 3, variants: null, scope: "product", qty: 2 })).toEqual({
      kind: "ok",
      scope: "product",
      nextStock: 5,
      nextVariants: null,
    })
  })

  it("adds them back to the variant row of the SAME name only, keeping the raw json and the aggregate in step", () => {
    const variants = {
      colors: ["Rouge"],
      variantRows: [
        { id: "r1", name: "Rouge / S", stock: 0, extra: "kept" },
        { id: "r2", name: "Rouge / M", stock: 4 },
      ],
    }
    const plan = planStockRestitution({ stock: 4, variants, scope: "variant", variantRowName: "rouge /  s", qty: 2 })
    expect(plan).toMatchObject({ kind: "ok", scope: "variant", nextStock: 6 })
    const next = (plan as { nextVariants: typeof variants }).nextVariants
    expect(next.variantRows[0]).toEqual({ id: "r1", name: "Rouge / S", stock: 2, extra: "kept" })
    expect(next.variantRows[1]!.stock).toBe(4)
    expect(variants.variantRows[0]!.stock).toBe(0) // the input is not mutated
  })

  it("gives nothing back when the row is gone, ambiguous, or the product has no rows any more (under-sell, never mis-credit)", () => {
    const rows = { variantRows: [{ name: "Bleu / S", stock: 1 }, { name: "Rouge / S", stock: 1 }, { name: "Rouge / S", stock: 0 }] }
    expect(planStockRestitution({ stock: 2, variants: rows, scope: "variant", variantRowName: "Vert / S", qty: 1 })).toEqual({
      kind: "skip",
      reason: "variant_row_gone",
    })
    expect(planStockRestitution({ stock: 2, variants: rows, scope: "variant", variantRowName: "Rouge / S", qty: 1 })).toEqual({
      kind: "skip",
      reason: "variant_row_ambiguous",
    })
    expect(planStockRestitution({ stock: 2, variants: null, scope: "variant", variantRowName: "Rouge / S", qty: 1 })).toEqual({
      kind: "skip",
      reason: "not_variant_rows",
    })
    expect(planStockRestitution({ stock: 2, variants: null, scope: "product", qty: 0 })).toEqual({
      kind: "skip",
      reason: "invalid_quantity",
    })
  })
})

describe("reservation marker", () => {
  it("round-trips and refuses what it did not write", () => {
    const row = buildStockReservedAuditRow({
      orderId: "o1",
      productId: "p1",
      qty: 2,
      scope: "variant",
      variantRowName: "Rouge / S",
      stripeSessionId: "cs_1",
    })
    expect(row).toMatchObject({ id: "stock-reserved:o1", action: "stock.reserved", entityType: "Order", entityId: "o1" })
    expect(parseStockReservationPayload(row.payload)).toEqual(row.payload)
    expect(parseStockReservationPayload({ ...row.payload, qty: 0 })).toBeNull()
    expect(parseStockReservationPayload({ ...row.payload, qty: 1.5 })).toBeNull()
    expect(parseStockReservationPayload({ ...row.payload, scope: "warehouse" })).toBeNull()
    expect(parseStockReservationPayload({ ...row.payload, variantRowName: null })).toBeNull() // variant without its row
    expect(parseStockReservationPayload("x")).toBeNull()
    expect(stockRestoredAuditId("o1")).toBe("stock-restored:o1")
  })
})

describe("evaluateStockRestitution", () => {
  const closed = {
    status: "refunded",
    paymentSettlementStatus: "REFUNDED",
    shippedAt: null,
    trackingNumber: null,
    supplierOrderId: null,
    fulfillmentStatus: "PENDING",
  }

  it("never gives back goods that reached the buyer or came back through a return (inspection decides)", () => {
    expect(evaluateStockRestitution({ ...closed, deliveredAt: new Date() })).toEqual({
      eligible: false,
      reason: "order_delivered",
    })
    expect(evaluateStockRestitution({ ...closed, returnCount: 1 })).toEqual({
      eligible: false,
      reason: "return_requested",
    })
    expect(evaluateStockRestitution({ ...closed, deliveredAt: null, returnCount: 0 })).toEqual({ eligible: true })
  })

  it("gives back the stock of a closed order that never shipped", () => {
    expect(evaluateStockRestitution(closed)).toEqual({ eligible: true })
    expect(evaluateStockRestitution({ ...closed, status: "cancelled", paymentSettlementStatus: "CANCELLED" })).toEqual({
      eligible: true,
    })
  })

  it("never for an open order, a partially refunded one, a shipped one, or one bought from a supplier", () => {
    expect(evaluateStockRestitution({ ...closed, status: "paid", paymentSettlementStatus: "PAID" })).toEqual({
      eligible: false,
      reason: "order_open",
    })
    expect(evaluateStockRestitution({ ...closed, status: "paid", paymentSettlementStatus: "PARTIALLY_REFUNDED" })).toEqual({
      eligible: false,
      reason: "order_open",
    })
    expect(evaluateStockRestitution({ ...closed, shippedAt: new Date() })).toMatchObject({ reason: "order_shipped" })
    expect(evaluateStockRestitution({ ...closed, trackingNumber: "LP123" })).toMatchObject({ reason: "order_shipped" })
    expect(evaluateStockRestitution({ ...closed, supplierOrderId: "8180" })).toMatchObject({ reason: "supplier_purchase_exists" })
    expect(evaluateStockRestitution({ ...closed, fulfillmentStatus: "ORDERED" })).toMatchObject({
      reason: "supplier_purchase_exists",
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// restoreStockForClosedOrders — in-memory stand-in for AuditLog / Order / Product.

type Product = { stock: number; variants: unknown }
const mem = vi.hoisted(() => ({
  audit: new Map<string, { id: string; action: string; entityId: string; payload: unknown; createdAt: Date }>(),
  orders: new Map<string, Record<string, unknown>>(),
  products: new Map<string, Product>(),
  locks: [] as string[],
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => {
  const auditLog = {
    createMany: vi.fn(async ({ data }: { data: Array<{ id: string; action: string; entityId: string; payload: unknown }> }) => {
      let count = 0
      for (const row of data) {
        if (mem.audit.has(row.id)) continue
        mem.audit.set(row.id, { ...row, createdAt: new Date() })
        count++
      }
      return { count }
    }),
  }
  const order = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => mem.orders.get(where.id) ?? null),
  }
  const product = {
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { stock: number | { increment: number }; variants?: unknown } }) => {
      const p = mem.products.get(where.id)!
      p.stock = typeof data.stock === "number" ? data.stock : p.stock + data.stock.increment
      if (data.variants !== undefined) p.variants = data.variants
      return p
    }),
  }
  const tx = {
    auditLog,
    order,
    product,
    $queryRaw: vi.fn(async (_s: TemplateStringsArray, id: string) => {
      mem.locks.push(id)
      const p = mem.products.get(id)
      return p ? [{ ...p }] : []
    }),
  }
  return {
    prisma: {
      // candidate query: reservation markers without a restored marker whose order is closed
      $queryRaw: vi.fn(async () =>
        [...mem.audit.values()]
          .filter((a) => a.action === "stock.reserved" && !mem.audit.has(`stock-restored:${a.entityId}`))
          .filter((a) => {
            const o = mem.orders.get(a.entityId)
            return o && ["refunded", "cancelled"].includes(String(o.status))
          })
          .map((a) => ({ orderId: a.entityId, payload: a.payload }))
      ),
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  }
})

import { restoreStockForClosedOrders } from "@/lib/stock-restitution.server"

function reserve(orderId: string, payload: Record<string, unknown>, order: Record<string, unknown>) {
  const row = buildStockReservedAuditRow({
    orderId,
    stripeSessionId: "cs",
    variantRowName: null,
    ...payload,
  } as Parameters<typeof buildStockReservedAuditRow>[0])
  mem.audit.set(row.id, { ...row, createdAt: new Date() })
  mem.orders.set(orderId, {
    status: "refunded",
    paymentSettlementStatus: "REFUNDED",
    shippedAt: null,
    trackingNumber: null,
    supplierOrderId: null,
    fulfillmentStatus: "PENDING",
    ...order,
  })
}

beforeEach(() => {
  mem.audit.clear()
  mem.orders.clear()
  mem.products.clear()
  mem.locks = []
  vi.spyOn(console, "log").mockImplementation(() => undefined)
})

describe("restoreStockForClosedOrders", () => {
  it("gives back a refunded, never-shipped order's units ONCE, under the product lock", async () => {
    mem.products.set("p1", { stock: 1, variants: null })
    reserve("o1", { productId: "p1", qty: 2, scope: "product" }, {})

    expect(await restoreStockForClosedOrders()).toEqual([{ orderId: "o1", outcome: "restored" }])
    expect(await restoreStockForClosedOrders()).toEqual([]) // marker written: not a candidate any more
    expect(mem.products.get("p1")!.stock).toBe(3)
    expect(mem.locks).toEqual(["p1"])
    expect(mem.audit.get("stock-restored:o1")!.payload).toMatchObject({ outcome: "restored", qty: 2 })
  })

  it("gives a variant reservation back to its row", async () => {
    mem.products.set("p1", { stock: 0, variants: { variantRows: [{ name: "Rouge / S", stock: 0 }] } })
    reserve("o1", { productId: "p1", qty: 1, scope: "variant", variantRowName: "Rouge / S" }, { status: "cancelled" })

    await restoreStockForClosedOrders()

    expect(mem.products.get("p1")).toEqual({ stock: 1, variants: { variantRows: [{ name: "Rouge / S", stock: 1 }] } })
  })

  it("never gives back a shipped order's units, and records why so it is not examined again", async () => {
    mem.products.set("p1", { stock: 0, variants: null })
    reserve("o1", { productId: "p1", qty: 1, scope: "product" }, { shippedAt: new Date(), trackingNumber: "LP1" })

    expect(await restoreStockForClosedOrders()).toEqual([{ orderId: "o1", outcome: "order_shipped" }])
    expect(await restoreStockForClosedOrders()).toEqual([])
    expect(mem.products.get("p1")!.stock).toBe(0)
  })

  it("never for an order already bought from a supplier", async () => {
    mem.products.set("p1", { stock: 0, variants: null })
    reserve("o1", { productId: "p1", qty: 1, scope: "product" }, { supplierOrderId: "8180000000000001" })

    expect(await restoreStockForClosedOrders()).toEqual([{ orderId: "o1", outcome: "supplier_purchase_exists" }])
    expect(mem.products.get("p1")!.stock).toBe(0)
  })

  it("leaves an open order alone and writes nothing for it", async () => {
    mem.products.set("p1", { stock: 0, variants: null })
    reserve("o1", { productId: "p1", qty: 1, scope: "product" }, { status: "paid", paymentSettlementStatus: "PAID" })

    expect(await restoreStockForClosedOrders()).toEqual([]) // not a candidate (not closed)
    expect(mem.audit.has("stock-restored:o1")).toBe(false)
  })

  it("records a variant row that disappeared instead of crediting another one", async () => {
    mem.products.set("p1", { stock: 5, variants: { variantRows: [{ name: "Bleu / S", stock: 5 }] } })
    reserve("o1", { productId: "p1", qty: 1, scope: "variant", variantRowName: "Rouge / S" }, {})

    expect(await restoreStockForClosedOrders()).toEqual([{ orderId: "o1", outcome: "variant_row_gone" }])
    expect(mem.products.get("p1")!.stock).toBe(5)
  })
})
