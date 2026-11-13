import { beforeEach, describe, expect, it, vi } from "vitest"

// Finalisation master doc, D3: POST /api/orders/[id]/mark-shipped had no status guard, so a supplier could "ship" a
// refunded order and release the supplier payout. It now accepts only paid / preparing / shipped.

const orderUpdate = vi.fn(async (_arg?: unknown) => ({}))
const findUnique = vi.fn()

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "sup_1" } }) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (arg: unknown) => findUnique(arg), update: (arg: unknown) => orderUpdate(arg) },
    supplierProfile: { findUnique: async () => null },
  },
}))
vi.mock("@/lib/stripe-lightning", () => ({ triggerLightningPayout: vi.fn(async () => ({})) }))
vi.mock("@/lib/trusted-carriers-shared", () => ({
  extractShippingCountryIso2FromAddress: () => "FR",
  isTrustedCarrierLabelForCountry: () => true,
}))
vi.mock("@/lib/ship-tracking-validate", () => ({
  validateShipTrackingForShip: vi.fn(async () => ({ ok: false, message: "stop here", code: "stub", params: {} })),
}))
vi.mock("@/lib/order-tracking-event", () => ({ recordOrderTrackingEvent: vi.fn(async () => {}) }))
vi.mock("@/lib/order-tracking-lock.shared", () => ({
  assertSupplierMayRegisterTracking: () => ({ ok: true }),
  trackingLockWriteFields: () => ({}),
}))

import { POST } from "@/app/api/orders/[id]/mark-shipped/route"

const body = JSON.stringify({ trackingNumber: "TRK123", trackingCarrier: "Colissimo" })

function call() {
  return POST(
    new Request("http://localhost/api/orders/ord_1/mark-shipped", { method: "POST", body }),
    { params: Promise.resolve({ id: "ord_1" }) }
  )
}

function order(over: Record<string, unknown>) {
  return {
    id: "ord_1",
    supplierId: "sup_1",
    status: "paid",
    paymentSettlementStatus: "PAID",
    shippingAddress: null,
    trackingNumber: null,
    trackingLockedAt: null,
    supplier: { id: "sup_1" },
    ...over,
  }
}

describe("mark-shipped status guard", () => {
  beforeEach(() => {
    findUnique.mockReset()
    orderUpdate.mockClear()
  })

  it.each([
    ["refunded", { status: "refunded" }],
    ["cancelled", { status: "CANCELLED" }],
    ["delivered", { status: "delivered" }],
    ["returned", { status: "returned" }],
    ["pending (never paid)", { status: "PENDING" }],
    ["stale paid status but REFUNDED settlement", { status: "paid", paymentSettlementStatus: "REFUNDED" }],
    ["REFUND_PENDING_CLAWBACK settlement", { status: "paid", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" }],
  ])("answers 409 order_not_shippable for %s and never writes", async (_label, over) => {
    findUnique.mockResolvedValue(order(over))
    const res = await call()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "order_not_shippable" })
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it.each(["paid", "preparing", "shipped", "PAID"])("lets a %s order through to the next checks", async (status) => {
    findUnique.mockResolvedValue(order({ status }))
    const res = await call()
    // The tracking validator is stubbed to refuse: reaching it (400) proves the status guard did not stop the request.
    expect(res.status).toBe(400)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("still refuses someone who is not the order's supplier", async () => {
    findUnique.mockResolvedValue(order({ supplier: { id: "someone_else" } }))
    const res = await call()
    expect(res.status).toBe(403)
  })
})
