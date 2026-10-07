import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  orderFindUnique: vi.fn(),
  returnCreate: vi.fn(),
  notificationCreate: vi.fn(),
  loadDays: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: m.orderFindUnique },
    orderReturn: { create: m.returnCreate },
    notification: { create: m.notificationCreate },
  },
}))
vi.mock("@/lib/return-terms.server", () => ({ loadOrderReturnWindowDaysFor: m.loadDays }))

import { POST } from "@/app/api/account/orders/[orderId]/return/route"

const DAY = 24 * 60 * 60 * 1000
const deliveredDaysAgo = (n: number) => new Date(Date.now() - n * DAY)

function order(deliveredAt: Date) {
  return {
    id: "ord1",
    status: "shipped",
    customerEmail: "buyer@example.com",
    buyerUserId: "u1",
    supplierId: "s1",
    sellingPriceCents: 4990,
    deliveredAt,
    deliveryConfirmedAt: null,
    returns: [],
    product: { name: "Lamp" },
  }
}

const call = () =>
  POST(
    new Request("http://x/api", { method: "POST", body: JSON.stringify({ reasonCode: "CHANGED_MIND" }) }),
    { params: Promise.resolve({ orderId: "ord1" }) }
  )

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset())
  m.auth.mockResolvedValue({ user: { id: "u1", email: "buyer@example.com" } })
  m.returnCreate.mockResolvedValue({ id: "r1", status: "REQUESTED", reasonCode: "CHANGED_MIND", sellerRespondByAt: new Date() })
  m.notificationCreate.mockResolvedValue({})
})

describe("POST /api/account/orders/[orderId]/return — window frozen at purchase", () => {
  it("refuses day 20 when only the legal 14 days apply (behaviour unchanged)", async () => {
    m.orderFindUnique.mockResolvedValue(order(deliveredDaysAgo(20)))
    m.loadDays.mockResolvedValue(14)
    const res = await call()
    expect(res.status).toBe(400)
    expect(m.returnCreate).not.toHaveBeenCalled()
  })

  it("accepts day 20 when the supplier offered 30 days on that product", async () => {
    m.orderFindUnique.mockResolvedValue(order(deliveredDaysAgo(20)))
    m.loadDays.mockResolvedValue(30)
    const res = await call()
    expect(res.status).toBe(200)
    expect(m.returnCreate).toHaveBeenCalledTimes(1)
    // The cost stays with the supplier, exactly like any other return: the supplier is told and decides on the case.
    expect(m.notificationCreate.mock.calls[0]![0].data.userId).toBe("s1")
  })

  it("still refuses once the offered window itself is over", async () => {
    m.orderFindUnique.mockResolvedValue(order(deliveredDaysAgo(35)))
    m.loadDays.mockResolvedValue(30)
    expect((await call()).status).toBe(400)
    expect(m.returnCreate).not.toHaveBeenCalled()
  })

  it("an extended window never opens returns for someone else's order", async () => {
    m.orderFindUnique.mockResolvedValue({ ...order(deliveredDaysAgo(20)), customerEmail: "other@example.com", buyerUserId: "u2" })
    m.loadDays.mockResolvedValue(90)
    expect((await call()).status).toBe(403)
  })
})
