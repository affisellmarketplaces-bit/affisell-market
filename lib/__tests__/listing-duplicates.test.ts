import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  attributeFindMany: vi.fn(),
  productFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productAttribute: { findMany: mocks.attributeFindMany },
    product: { findMany: mocks.productFindMany },
  },
}))

import { findSupplierProductDuplicates } from "@/lib/listing-compliance/duplicates.server"

const p = (id: string, name = `P ${id}`) => ({ id, name, isDraft: false, active: true })

describe("findSupplierProductDuplicates", () => {
  beforeEach(() => {
    mocks.attributeFindMany.mockReset().mockResolvedValue([])
    mocks.productFindMany.mockReset().mockResolvedValue([])
  })

  it("only ever looks inside the supplier's own catalogue, never at itself", async () => {
    await findSupplierProductDuplicates({ supplierId: "s1", gtin: "4006381333931", name: "Lampe", imageUrl: "https://cdn/x.jpg", excludeId: "me" })
    expect(mocks.attributeFindMany.mock.calls[0]![0].where).toEqual({
      key: "ean",
      value: "4006381333931",
      product: { supplierId: "s1", id: { not: "me" } },
    })
    for (const call of mocks.productFindMany.mock.calls) {
      expect(call[0].where).toMatchObject({ supplierId: "s1", id: { not: "me" } })
    }
  })

  it("normalises the GTIN before searching", async () => {
    await findSupplierProductDuplicates({ supplierId: "s1", gtin: "400-6381 333931" })
    expect(mocks.attributeFindMany.mock.calls[0]![0].where.value).toBe("4006381333931")
  })

  it("skips queries that cannot be meaningful (short GTIN, short name, non-http image)", async () => {
    await findSupplierProductDuplicates({ supplierId: "s1", gtin: "123", name: "ab", imageUrl: "data:image/png;base64,AAA" })
    expect(mocks.attributeFindMany).not.toHaveBeenCalled()
    expect(mocks.productFindMany).not.toHaveBeenCalled()
  })

  it("reports each product once, with the most certain reason (gtin > image > name)", async () => {
    mocks.attributeFindMany.mockResolvedValue([{ product: p("a") }])
    mocks.productFindMany
      .mockResolvedValueOnce([p("a"), p("b")]) // same image
      .mockResolvedValueOnce([p("b"), p("c")]) // same name
    const out = await findSupplierProductDuplicates({ supplierId: "s1", gtin: "4006381333931", imageUrl: "https://cdn/x.jpg", name: "Lampe" })
    expect(out.map((d) => `${d.id}:${d.reason}`)).toEqual(["a:gtin", "b:same_image", "c:same_name"])
  })

  it("matches the name case-insensitively and caps the list", async () => {
    mocks.productFindMany.mockResolvedValue(Array.from({ length: 9 }, (_, i) => p(`n${i}`)))
    const out = await findSupplierProductDuplicates({ supplierId: "s1", name: "  LAMPE  " })
    expect(mocks.productFindMany.mock.calls[0]![0].where.name).toEqual({ equals: "LAMPE", mode: "insensitive" })
    expect(out).toHaveLength(5)
  })
})
