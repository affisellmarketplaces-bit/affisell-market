import { describe, expect, it, vi, beforeEach } from "vitest"

const { findMany, updateMany, transaction } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany },
    notification: { updateMany },
    $transaction: transaction,
  },
}))

import {
  enrichSupplierNotificationRows,
  reopenLegacySupplierToShipAlerts,
} from "@/lib/supplier-order-alert-inbox"

describe("supplier-order-alert-inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reopens read alerts once for legacy to-ship orders missing inbox flag", async () => {
    findMany.mockResolvedValue([{ id: "ord_1" }, { id: "ord_2" }])
    updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 2 })
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
      fn({
        notification: { updateMany },
        order: { updateMany },
      })
    )

    const count = await reopenLegacySupplierToShipAlerts("sup_1")
    expect(count).toBe(2)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "sup_1", type: "NEW_ORDER" }),
        data: { read: false },
      })
    )
  })

  it("flags actionRequired for to-ship NEW_ORDER rows", () => {
    const rows = enrichSupplierNotificationRows(
      [
        {
          id: "n1",
          type: "NEW_ORDER",
          message: "test",
          imageUrl: null,
          orderId: "ord_1",
          read: true,
          createdAt: new Date(),
        },
      ],
      new Set(["ord_1"])
    )
    expect(rows[0]?.actionRequired).toBe(true)
  })
})
