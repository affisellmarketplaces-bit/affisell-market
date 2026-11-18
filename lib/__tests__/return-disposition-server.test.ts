import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const m = vi.hoisted(() => ({
  ret: null as null | Record<string, unknown>,
  audit: new Map<string, { payload?: unknown }>(),
  upserts: [] as string[],
  productUpdates: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/prisma", () => {
  const tx = {
    $queryRaw: async () => [{ stock: 3, variants: null }],
    auditLog: {
      createMany: async (a: { data: Array<{ id: string }> }) => {
        const id = a.data[0]!.id
        if (m.audit.has(id)) return { count: 0 }
        m.audit.set(id, {})
        return { count: 1 }
      },
    },
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
        upsert: async (a: { where: { id: string } }) => {
          m.upserts.push(a.where.id)
          return {}
        },
      },
      $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  }
})

import { recordReturnInspection } from "@/lib/return-disposition.server"

const args = { returnId: "r1", supplierId: "s1", outcome: "resellable" as const, note: "intact" }
const reservation = { productId: "p1", qty: 1, scope: "product", variantRowName: null, stripeSessionId: "cs" }

describe("recordReturnInspection", () => {
  beforeEach(() => {
    m.ret = { id: "r1", status: "RECEIVED", receivedAt: new Date(), order: { id: "o1", supplierId: "s1", quantity: 1 } }
    m.audit.clear()
    m.upserts.length = 0
    m.productUpdates.length = 0
  })
  afterEach(() => vi.unstubAllEnvs())

  it("records the inspection; restocking is off by default", async () => {
    m.audit.set("stock-reserved:o1", { payload: reservation })
    expect(await recordReturnInspection(args)).toMatchObject({ ok: true, restock: "none", reason: "mode_off" })
    expect(m.upserts).toEqual(["return-inspection:r1"])
    expect(m.productUpdates).toHaveLength(0)
  })

  it("enforce: resellable goods the sale really took go back once", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    m.audit.set("stock-reserved:o1", { payload: reservation })
    expect(await recordReturnInspection(args)).toMatchObject({ ok: true, restock: "restocked", qty: 1 })
    expect(m.productUpdates[0]).toEqual({ stock: { increment: 1 } })
    expect(await recordReturnInspection(args)).toEqual({ ok: false, error: "already_restocked" })
  })

  it("enforce: no reservation marker = the sale never took units = nothing restocked", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    expect(await recordReturnInspection(args)).toMatchObject({ restock: "none", reason: "never_decremented" })
  })

  it("enforce: units already given back by the closed-order restitution are not given back twice", async () => {
    vi.stubEnv("RETURN_RESTOCK_MODE", "enforce")
    m.audit.set("stock-reserved:o1", { payload: reservation })
    m.audit.set("stock-restored:o1", { payload: { outcome: "restored" } })
    expect(await recordReturnInspection(args)).toMatchObject({ restock: "none", reason: "already_restocked" })
  })

  it("refuses another supplier's return and goods not received", async () => {
    expect(await recordReturnInspection({ ...args, supplierId: "other" })).toEqual({ ok: false, error: "forbidden" })
    m.ret = { ...m.ret!, status: "IN_TRANSIT", receivedAt: null }
    expect(await recordReturnInspection(args)).toEqual({ ok: false, error: "not_received" })
  })
})
