import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

type Row = { id: string; action?: string; entityId?: string; payload?: unknown; createdAt?: Date }

const m = vi.hoisted(() => ({
  ret: null as null | Record<string, unknown>,
  audit: new Map<string, Row>(),
  productUpdates: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/prisma", () => {
  const createMany = async (a: { data: Array<Row> }) => {
    const row = a.data[0]!
    if (m.audit.has(row.id)) return { count: 0 }
    m.audit.set(row.id, { ...row, createdAt: new Date(Date.now() + m.audit.size) })
    return { count: 1 }
  }
  const tx = {
    $queryRaw: async () => [{ stock: 3, variants: null }],
    auditLog: { createMany },
    product: {
      update: async (a: { data: Record<string, unknown> }) => {
        m.productUpdates.push(a.data)
        return {}
      },
    },
  }
  return {
    prisma: {
      orderReturn: { findUnique: async () => m.ret },
      auditLog: {
        findUnique: async (a: { where: { id: string } }) => m.audit.get(a.where.id) ?? null,
        createMany,
        count: async (a: { where: { action: string; entityId: string; NOT?: { id: string } } }) =>
          [...m.audit.values()].filter(
            (r) => r.action === a.where.action && r.entityId === a.where.entityId && r.id !== a.where.NOT?.id
          ).length,
        upsert: async (a: { where: { id: string }; create: Row }) => {
          m.audit.set(a.where.id, { ...a.create, createdAt: new Date() })
          return {}
        },
        findMany: async (a: { where: { entityId: string; action: { in: string[] }; NOT: { id: string } } }) =>
          [...m.audit.values()]
            .filter((r) => r.entityId === a.where.entityId && a.where.action.in.includes(r.action ?? "") && r.id !== a.where.NOT.id)
            .sort((x, y) => x.createdAt!.getTime() - y.createdAt!.getTime()),
      },
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  }
})

import {
  decideReturnDisposition,
  loadReturnDispositionTimeline,
  recordReturnInspection,
} from "@/lib/return-disposition.server"

const inspect = { returnId: "r1", supplierId: "s1", outcome: "resellable" as const, note: "intact" }
const restock = { returnId: "r1", supplierId: "s1", decision: "restock" as const, note: "remis en rayon" }
const reservation = { productId: "p1", qty: 1, scope: "product", variantRowName: null, stripeSessionId: "cs" }

describe("returns — inspection and decision are two traced steps", () => {
  beforeEach(() => {
    m.ret = { id: "r1", status: "RECEIVED", receivedAt: new Date(), order: { id: "o1", supplierId: "s1", quantity: 1 } }
    m.audit.clear()
    m.productUpdates.length = 0
  })
  afterEach(() => vi.unstubAllEnvs())

  it("an inspection NEVER restocks, even in enforce, and every inspection is kept", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    m.audit.set("stock-reserved:o1", { id: "stock-reserved:o1", payload: reservation })
    expect(await recordReturnInspection({ ...inspect, outcome: "damaged" })).toEqual({ ok: true, outcome: "damaged", inspection: 1 })
    expect(await recordReturnInspection(inspect)).toEqual({ ok: true, outcome: "resellable", inspection: 2 })
    expect(m.productUpdates).toHaveLength(0)
    expect(m.audit.has("return-inspection:r1:1") && m.audit.has("return-inspection:r1:2")).toBe(true)
  })

  it("no decision without an inspection; restock refused when the latest inspection is not resellable", async () => {
    expect(await decideReturnDisposition(restock)).toEqual({ ok: false, error: "not_inspected" })
    await recordReturnInspection({ ...inspect, outcome: "defective" })
    expect(await decideReturnDisposition(restock)).toEqual({ ok: false, error: "not_resellable" })
    expect(await decideReturnDisposition({ ...restock, decision: "keep_out" })).toMatchObject({ ok: true, restock: "none" })
  })

  it("a validated restock is recorded but applies nothing while the mode is off (default)", async () => {
    m.audit.set("stock-reserved:o1", { id: "stock-reserved:o1", payload: reservation })
    await recordReturnInspection(inspect)
    expect(await decideReturnDisposition(restock)).toMatchObject({ ok: true, restock: "none", reason: "mode_off" })
    expect(m.productUpdates).toHaveLength(0)
    const t = await loadReturnDispositionTimeline("r1", "s1")
    expect(t?.stage).toBe("restock_validated_not_applied")
    expect(t?.events.map((e) => e.kind)).toEqual(["received", "inspected", "decided"])
  })

  it("enforce: a validated restock of goods the sale really took goes back once, and is traced", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    m.audit.set("stock-reserved:o1", { id: "stock-reserved:o1", payload: reservation })
    await recordReturnInspection(inspect)
    expect(await decideReturnDisposition(restock)).toMatchObject({ ok: true, restock: "restocked", qty: 1 })
    expect(m.productUpdates[0]).toEqual({ stock: { increment: 1 } })
    expect(await decideReturnDisposition(restock)).toEqual({ ok: false, error: "already_restocked" })
    expect(await recordReturnInspection(inspect)).toEqual({ ok: false, error: "already_restocked" })
    expect((await loadReturnDispositionTimeline("r1", "s1"))?.stage).toBe("restocked")
  })

  it("enforce: never when the sale did not take units, nor twice after the closed-order restitution", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    await recordReturnInspection(inspect)
    expect(await decideReturnDisposition(restock)).toMatchObject({ restock: "none", reason: "never_decremented" })
    m.audit.set("stock-reserved:o1", { id: "stock-reserved:o1", payload: reservation })
    m.audit.set("stock-restored:o1", { id: "stock-restored:o1", payload: { outcome: "restored" } })
    expect(await decideReturnDisposition(restock)).toMatchObject({ restock: "none", reason: "already_restocked" })
    expect(m.productUpdates).toHaveLength(0)
  })

  it("refuses another supplier's return and goods not received", async () => {
    expect(await recordReturnInspection({ ...inspect, supplierId: "other" })).toEqual({ ok: false, error: "forbidden" })
    expect(await loadReturnDispositionTimeline("r1", "other")).toBeNull()
    m.ret = { ...m.ret!, status: "IN_TRANSIT", receivedAt: null }
    expect(await recordReturnInspection(inspect)).toEqual({ ok: false, error: "not_received" })
    expect(await decideReturnDisposition(restock)).toEqual({ ok: false, error: "not_received" })
  })
})
