import { readFileSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  PRODUCT_SUSPENDED_ERROR,
  commercialHolds,
  isSuspensionReason,
  offSaleCause,
  parseSuspensionState,
  suspensionStateId,
} from "@/lib/products/affisell-suspension"

vi.mock("server-only", () => ({}))

type Row = { id: string; action?: string; entityId?: string; payload?: unknown; actorId?: string }
const m = vi.hoisted(() => ({
  product: null as null | { id: string; active: boolean },
  recalls: [] as Array<{ status: string }>,
  audit: new Map<string, Row>(),
  failReads: false,
}))

vi.mock("@/lib/prisma", () => {
  const auditLog = {
    findUnique: async (a: { where: { id: string } }) => {
      if (m.failReads) throw new Error("db down")
      return m.audit.get(a.where.id) ?? null
    },
    findMany: async (a: { where: { entityId: string; NOT: { id: string } } }) =>
      [...m.audit.values()].filter((r) => r.entityId === a.where.entityId && r.id !== a.where.NOT.id),
    count: async (a: { where: { action: string; entityId: string } }) =>
      [...m.audit.values()].filter((r) => r.action === a.where.action && r.entityId === a.where.entityId).length,
    create: async (a: { data: Row }) => {
      if (m.audit.has(a.data.id)) throw new Error("unique violation")
      m.audit.set(a.data.id, a.data)
      return a.data
    },
    upsert: async (a: { where: { id: string }; create: Row; update: Partial<Row> }) => {
      const cur = m.audit.get(a.where.id)
      m.audit.set(a.where.id, cur ? { ...cur, ...a.update } : a.create)
      return {}
    },
  }
  const productRecall = {
    findMany: async () => {
      if (m.failReads) throw new Error("db down")
      return m.recalls
    },
  }
  const product = {
    findUnique: async () => m.product,
    update: async (a: { data: { active: boolean } }) => {
      if (m.product) m.product.active = a.data.active
      return m.product
    },
  }
  const tx = { $queryRaw: async () => (m.product ? [{ ...m.product }] : []), auditLog, productRecall, product }
  return { prisma: { auditLog, productRecall, product, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

beforeEach(() => {
  m.product = { id: "p1", active: true }
  m.recalls = []
  m.audit.clear()
  m.failReads = false
})

describe("pure rules", () => {
  it("an unreadable state is a suspension (fail closed)", () => {
    expect(parseSuspensionState(null).state).toBe("suspended")
    expect(parseSuspensionState({ state: "lifted" }).state).toBe("lifted")
  })
  it("holds list recall first, then suspension; a closed recall does not hold", () => {
    expect(commercialHolds({ recallStatuses: ["closed"], suspension: null })).toEqual([])
    expect(
      commercialHolds({ recallStatuses: ["open"], suspension: parseSuspensionState({ state: "suspended" }) })
    ).toEqual(["product_recalled", "product_suspended"])
  })
  it("the off-sale cause tells the supplier pause from the Affisell hold", () => {
    expect(offSaleCause({ active: false, holds: [] })).toBe("paused_by_supplier")
    expect(offSaleCause({ active: false, holds: ["product_suspended"] })).toBe("held_by_affisell")
    expect(offSaleCause({ active: true, holds: [] })).toBe("on_sale")
  })
  it("reasons are a closed list", () => {
    expect(isSuspensionReason("product_safety")).toBe(true)
    expect(isSuspensionReason("whatever")).toBe(false)
  })
})

describe("suspend / lift", () => {
  it("suspending takes the product off sale and blocks the supplier; lifting gives the decision back without re-listing", async () => {
    const s = await import("@/lib/products/affisell-suspension.server")
    expect(await s.suspendProduct({ productId: "p1", adminId: "a", reason: "legal_or_ip", note: "takedown" })).toEqual({
      ok: true,
      wasActive: true,
    })
    expect(m.product?.active).toBe(false)
    expect(await s.checkSupplierMayActivate("p1")).toEqual({ held: true, error: PRODUCT_SUSPENDED_ERROR })
    expect((await s.suspendProduct({ productId: "p1", adminId: "a", reason: "other", note: "again" })).ok).toBe(false)

    expect(await s.liftProductSuspension({ productId: "p1", adminId: "a", note: "resolved" })).toEqual({
      ok: true,
      recallStillOpen: false,
    })
    expect(m.product?.active).toBe(false)
    expect(await s.checkSupplierMayActivate("p1")).toEqual({ held: false })
    expect((await s.liftProductSuspension({ productId: "p1", adminId: "a", note: "x" })).ok).toBe(false)

    const view = await s.loadSuspensionView("p1")
    expect(view?.history.map((h) => h.state).sort()).toEqual(["lifted", "suspended"])
    expect(m.audit.get(suspensionStateId("p1"))).toBeTruthy()
  })

  it("an open recall still holds after the suspension is lifted", async () => {
    const s = await import("@/lib/products/affisell-suspension.server")
    m.recalls = [{ status: "open" }]
    await s.suspendProduct({ productId: "p1", adminId: "a", reason: "product_safety", note: "recall" })
    expect(await s.liftProductSuspension({ productId: "p1", adminId: "a", note: "ok" })).toEqual({
      ok: true,
      recallStillOpen: true,
    })
    expect(await s.checkSupplierMayActivate("p1")).toEqual({ held: true, error: "product_recalled" })
  })

  it("unreadable holds block activation", async () => {
    const s = await import("@/lib/products/affisell-suspension.server")
    m.failReads = true
    expect(await s.checkSupplierMayActivate("p1")).toEqual({ held: true, error: "product_hold_unverifiable" })
  })
})

describe("wiring", () => {
  const root = path.resolve(__dirname, "../..")
  it("the new codes are translated publish blockers in every locale", async () => {
    const { mapServerPublishBlockers } = await import("@/lib/supplier-publish-blockers")
    for (const code of ["product_suspended", "product_hold_unverifiable"]) {
      const [b] = mapServerPublishBlockers({ error: code }, "fr")
      expect(b?.message).toBeTruthy()
      expect(b?.message).not.toContain(code)
    }
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const msgs = JSON.parse(readFileSync(path.join(root, `messages/${loc}.json`), "utf8"))
      expect(typeof msgs.supplier.publishBlockers.productSuspended).toBe("string")
      expect(typeof msgs.supplier.publishBlockers.productHoldUnverifiable).toBe("string")
    }
  })
  it("the admin route is admin-only and same-site", () => {
    const src = readFileSync(path.join(root, "app/api/admin/products/[id]/suspension/route.ts"), "utf8")
    expect(src).toContain("requireAdminSession()")
    expect(src).toContain("assertSameSiteRequestOrigin(req)")
  })
})
