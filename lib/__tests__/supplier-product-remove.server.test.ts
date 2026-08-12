import { describe, expect, it, vi, beforeEach } from "vitest"

const {
  findFirst,
  count,
  findMany,
  deleteMany,
  productDelete,
  productUpdate,
  updateMany,
  transaction,
  cancelAuctionsForListings,
  notificationCreate,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  productDelete: vi.fn(),
  productUpdate: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  cancelAuctionsForListings: vi.fn(),
  notificationCreate: vi.fn(),
}))

vi.mock("@/lib/auction-listing-lifecycle", () => ({
  cancelAuctionsForListings,
}))

vi.mock("@/lib/revalidate-supplier-shopfront", () => ({
  revalidateSupplierShopfront: vi.fn(),
}))

vi.mock("@/lib/revalidate-affiliate-shopfront", () => ({
  revalidateAffiliateShopfront: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findFirst,
      delete: productDelete,
      update: productUpdate,
    },
    affiliateProduct: {
      count,
      findMany,
      deleteMany,
      updateMany,
    },
    notification: { create: notificationCreate },
    $transaction: transaction,
  },
}))

import {
  deleteSupplierProduct,
  recallSupplierProduct,
} from "@/lib/supplier-product-remove.server"

describe("deleteSupplierProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        for (const op of ops) await op
      }
    })
  })

  it("rejects delete when partners list live", async () => {
    findFirst.mockResolvedValue({
      id: "p1",
      name: "Hose",
      isDraft: false,
      active: true,
      images: [],
      _count: { orders: 0, affiliateProducts: 2 },
    })
    count.mockResolvedValue(2)

    const result = await deleteSupplierProduct("sup-1", "p1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("requires_recall")
      expect(result.listedAffiliateCount).toBe(2)
    }
    expect(transaction).not.toHaveBeenCalled()
  })

  it("deletes when no live partner listings", async () => {
    findFirst.mockResolvedValue({
      id: "p1",
      name: "Draft",
      isDraft: true,
      active: false,
      images: [],
      _count: { orders: 0, affiliateProducts: 0 },
    })
    count.mockResolvedValue(0)

    const result = await deleteSupplierProduct("sup-1", "p1")
    expect(result).toEqual({ ok: true })
    expect(transaction).toHaveBeenCalled()
  })
})

describe("recallSupplierProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        for (const op of ops) await op
      }
    })
    cancelAuctionsForListings.mockResolvedValue(0)
    notificationCreate.mockResolvedValue({})
  })

  it("unlists partner storefronts and pauses product", async () => {
    findFirst.mockResolvedValue({
      id: "p1",
      name: "Hose",
      isDraft: false,
      active: true,
      images: ["https://cdn/a.jpg"],
      _count: { orders: 0, affiliateProducts: 2 },
    })
    count.mockResolvedValue(2)
    findMany.mockResolvedValue([
      { id: "ap1", affiliateId: "aff-1" },
      { id: "ap2", affiliateId: "aff-2" },
    ])

    const result = await recallSupplierProduct("sup-1", "p1")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.listedAffiliatesUnlisted).toBe(2)
      expect(result.notificationsSent).toBe(2)
    }
    expect(cancelAuctionsForListings).toHaveBeenCalledWith(["ap1", "ap2"])
    expect(transaction).toHaveBeenCalled()
  })
})
