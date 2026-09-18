import { beforeEach, describe, expect, it, vi } from "vitest"

const { create, storeFindUnique, transaction } = vi.hoisted(() => ({
  create: vi.fn(),
  storeFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { create },
    productAttribute: { createMany: vi.fn() },
    store: { findUnique: storeFindUnique },
    $transaction: transaction,
  },
}))

vi.mock("@/lib/community-new-drop", () => ({
  createNewDropCommunityPost: vi.fn(),
}))

vi.mock("@/lib/product-auto-categorize", () => ({
  scheduleProductAutoCategorization: vi.fn(),
}))

import { insertBulkParsedProduct } from "@/lib/supplier-bulk-import-commit"
import type { ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"

const baseRow: ParsedBulkProductRow = {
  name: "Test product",
  description: "A product",
  priceEur: 19.9,
  compareAtEur: null,
  stock: 10,
  commissionPct: 15,
  listingKind: "PHYSICAL",
  images: ["https://cdn.example.com/a.jpg"],
  shippingBody: {},
  productAttributes: [],
}

describe("insertBulkParsedProduct — import source tagging", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeFindUnique.mockResolvedValue(null)
    create.mockResolvedValue({ id: "prod_1", name: "Test product" })
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ product: { create }, productAttribute: { createMany: vi.fn() } })
    )
  })

  it("defaults to the 'excel-bulk' tag when no source is passed (backward compatible)", async () => {
    await insertBulkParsedProduct("supplier_1", "cat_1", baseRow)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierTag: "excel-bulk",
          tags: ["excel-bulk"],
        }),
      })
    )
  })

  it("tags CSV-sourced imports as 'csv-import', not the Excel default", async () => {
    await insertBulkParsedProduct("supplier_1", "cat_1", baseRow, "csv-import")
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierTag: "csv-import",
          tags: ["csv-import"],
        }),
      })
    )
  })
})
