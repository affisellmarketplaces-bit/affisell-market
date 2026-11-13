/**
 * POST /api/orders/[id]/fulfill — how the per-order purchase gate's refusals are answered (HTTP status only).
 * A refused purchase (margin, claim in progress, outcome unknown) is a conflict the operator must read (409), never a 502
 * "supplier down" that an automatic caller would retry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ result: { ok: false, error: "x" } as Record<string, unknown> }))

vi.mock("@/lib/aliexpress-fulfill-order", () => ({ fulfillAffisellOrderWithAliExpress: async () => h.result }))
vi.mock("@/lib/aliexpress-ops-auth", () => ({
  authorizeAliExpressOps: () => null,
  extractBodySecret: () => undefined,
  stripBodySecret: (v: unknown) => v,
}))
vi.mock("@/lib/admin/authorize-admin-or-cron", () => ({ authorizeAdminOrCron: async () => ({ ok: true }) }))
vi.mock("@/lib/fulfillment/order-paid-queue", () => ({ enqueueOrderPaidJob: vi.fn() }))
vi.mock("@/lib/fulfillment/orchestrator", () => ({
  fulfillmentOrchestrator: { onOrderCreated: async () => ({ groupIds: [] }) },
}))

import { POST } from "@/app/api/orders/[id]/fulfill/route"

const call = async () =>
  POST(new Request("http://localhost/api/orders/o1/fulfill", { method: "POST" }), {
    params: Promise.resolve({ id: "o1" }),
  })

beforeEach(() => {
  h.result = { ok: false, error: "x" }
})

describe("fulfill route — gate refusals", () => {
  it.each([
    ["margin_refused:margin_below_floor", 409],
    ["margin_refused:cost_unknown", 409],
    ["fulfillment_in_progress", 409],
    ["supplier_outcome_uncertain", 409],
    ["not_paid", 409],
    ["order_not_found", 404],
    ["INVENTORY_SHORTAGE", 502],
    ["supplier_order_unrecorded", 502],
  ])("%s => HTTP %i", async (error, status) => {
    h.result = { ok: false, error, orderId: "o1" }
    const res = await call()
    expect(res.status).toBe(status)
  })

  it("success is a 200", async () => {
    h.result = { ok: true, orderId: "o1", aliexpressOrderId: "AE-1", status: "fulfilling" }
    expect((await call()).status).toBe(200)
  })
})
