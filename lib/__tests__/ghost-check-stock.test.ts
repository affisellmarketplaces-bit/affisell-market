import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockCheckLog: { create: vi.fn(async () => ({})) },
    product: {
      update: vi.fn(async () => ({ stockCheckFails: 1 })),
    },
  },
}))

vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: vi.fn(async () => ({ slack: false, discord: false })),
}))

vi.mock("@/lib/ghost/supplier-adapters", () => ({
  aliexpressCheck: vi.fn(async () => ({
    status: "out_of_stock",
    price: 9.9,
    checkedAt: new Date(),
    source: "aliexpress:mock",
  })),
  temuCheck: vi.fn(async () => null),
  amazonCheck: vi.fn(async () => null),
  detectGhostSupplierSource: vi.fn(() => "aliexpress"),
}))

import { checkStock } from "@/lib/ghost/check-stock"
import { prisma } from "@/lib/prisma"

describe("checkStock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("persists StockCheckLog and returns adapter status", async () => {
    const result = await checkStock({
      id: "prod_1",
      supplierSource: "aliexpress",
      supplierProductId: "100500",
      basePriceCents: 1990,
      stock: 10,
    })
    expect(result.status).toBe("out_of_stock")
    expect(prisma.stockCheckLog.create).toHaveBeenCalled()
    expect(prisma.product.update).toHaveBeenCalled()
  })
})
