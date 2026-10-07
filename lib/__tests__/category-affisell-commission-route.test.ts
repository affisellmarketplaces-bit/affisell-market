import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ auth: vi.fn(), category: vi.fn(), user: vi.fn(), resolveCategory: vi.fn() }))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { category: { findUnique: m.category }, user: { findUnique: m.user } } }))
vi.mock("@/lib/affisell-platform-commission.server", () => ({ resolveCategoryAffisellCommissionBps: m.resolveCategory }))

import { GET } from "@/app/api/supplier/category-affisell-commission/route"

const get = (qs = "categoryId=cat_1") => GET(new Request(`http://x/api/supplier/category-affisell-commission?${qs}`))

beforeEach(() => {
  m.auth.mockReset().mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
  m.category.mockReset().mockResolvedValue({ id: "cat_1", name: "Lamps", fullPath: "Home > Lamps", affisellCommissionRateBps: 1000 })
  m.resolveCategory.mockReset().mockResolvedValue(1000)
  m.user.mockReset().mockResolvedValue({ supplierFeeBps: null, supplierFeeBpsCatalog: null })
})

describe("GET /api/supplier/category-affisell-commission", () => {
  it("keeps the category rate fields and adds the rate THIS supplier pays (same as the category by default)", async () => {
    const body = await (await get()).json()
    expect(body).toMatchObject({ effectiveBps: 1000, effectivePercent: 10, supplierCatalogFeeBps: 1000, supplierCatalogFeePercent: 10 })
  })

  it("a negotiated per-supplier catalogue rate wins over the category grid, as at settlement", async () => {
    m.user.mockResolvedValue({ supplierFeeBps: null, supplierFeeBpsCatalog: 750 })
    const body = await (await get()).json()
    expect(body.effectiveBps).toBe(1000) // the category's own rate is still reported
    expect(body.supplierCatalogFeeBps).toBe(750)
  })

  it("the legacy all-modes override wins over the catalogue-only one", async () => {
    m.user.mockResolvedValue({ supplierFeeBps: 500, supplierFeeBpsCatalog: 750 })
    expect((await (await get()).json()).supplierCatalogFeeBps).toBe(500)
  })

  it("an override lookup failure falls back to the category rate instead of failing the request", async () => {
    m.user.mockRejectedValue(new Error("db down"))
    const res = await get()
    expect(res.status).toBe(200)
    expect((await res.json()).supplierCatalogFeeBps).toBe(1000)
  })

  it("is still supplier-only and validates its input", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await get()).status).toBe(401)
    m.auth.mockResolvedValue({ user: { id: "a", role: "AFFILIATE" } })
    expect((await get()).status).toBe(403)
    m.auth.mockResolvedValue({ user: { id: "sup_1", role: "SUPPLIER" } })
    expect((await get("")).status).toBe(400)
    m.category.mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })
})
