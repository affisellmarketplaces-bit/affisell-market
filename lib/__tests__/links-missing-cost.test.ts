/**
 * Read-only preflight: the links the margin gate will refuse because their cost is 0 / absent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  where: null as unknown,
  rows: [] as Array<Record<string, unknown>>,
  writes: 0,
  auth: { ok: true, session: { user: { id: "admin1" } } } as Record<string, unknown>,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierLink: {
      count: async (a: { where: unknown }) => {
        h.where = a.where
        return h.rows.length
      },
      findMany: async () => h.rows,
      update: async () => void h.writes++,
      updateMany: async () => void h.writes++,
      upsert: async () => void h.writes++,
    },
  },
}))
vi.mock("@/lib/admin/require-admin-session", () => ({ requireAdminSession: async () => h.auth }))

import { GET } from "@/app/api/admin/auto-fulfill/links-missing-cost/route"
import { listLinksMissingCost } from "@/lib/admin/auto-fulfill/links-missing-cost"

const row = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  productId: "p1",
  aeProductId: "1005007291234567",
  aePriceCents: 500,
  aeShippingCents: 0,
  product: { name: "Lamp" },
  variantMappings: [],
  ...over,
})

beforeEach(() => {
  h.rows = []
  h.writes = 0
  h.auth = { ok: true, session: { user: { id: "admin1" } } }
})

describe("listLinksMissingCost", () => {
  it("asks only for ACTIVE, auto-buy-enabled links with a price / shipping / variant price of 0 or less", async () => {
    await listLinksMissingCost()
    expect(h.where).toMatchObject({
      isActive: true,
      autoBuyEnabled: true,
      OR: [
        { aeShippingCents: { lte: 0 } },
        { aePriceCents: { lte: 0 } },
        { variantMappings: { some: { aePriceCents: { lte: 0 } } } },
      ],
    })
  })

  it("says which part of the cost is unknown, per link", async () => {
    h.rows = [
      row({ id: "a", aePriceCents: 500, aeShippingCents: 0 }),
      row({ id: "b", aePriceCents: 0, aeShippingCents: 0 }),
      row({ id: "c", aePriceCents: 500, aeShippingCents: 300, variantMappings: [{ id: "v1" }] }),
    ]
    const { total, links } = await listLinksMissingCost()
    expect(total).toBe(3)
    expect(links.map((l) => [l.supplierLinkId, l.missing])).toEqual([
      ["a", ["shipping"]],
      ["b", ["price", "shipping"]],
      ["c", ["variant_price"]],
    ])
    expect(links[0]).toMatchObject({ productName: "Lamp", aeProductId: "1005007291234567" })
  })

  it("writes NOTHING", async () => {
    h.rows = [row()]
    await listLinksMissingCost()
    expect(h.writes).toBe(0)
  })
})

describe("GET /api/admin/auto-fulfill/links-missing-cost", () => {
  it("is admin-only", async () => {
    h.auth = { ok: false, status: 403, error: "forbidden" }
    expect((await GET()).status).toBe(403)
  })

  it("returns the list", async () => {
    h.rows = [row()]
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()) as { total: number }).toMatchObject({ total: 1 })
  })
})
