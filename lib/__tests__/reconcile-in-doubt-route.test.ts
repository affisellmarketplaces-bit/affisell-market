/**
 * POST /api/admin/auto-fulfill/logs/[id]/reconcile — admin session only; validates the body; maps the log id to its order.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  auth: { ok: true, session: { user: { id: "admin1" } } } as Record<string, unknown>,
  log: { orderId: "o1" } as { orderId: string } | null,
  calls: [] as unknown[],
}))

vi.mock("@/lib/admin/require-admin-session", () => ({ requireAdminSession: async () => h.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { fulfillmentLog: { findUnique: async () => h.log } } }))
vi.mock("@/lib/admin/auto-fulfill/reconcile-in-doubt-purchase", () => ({
  reconcileInDoubtPurchase: async (input: unknown) => {
    h.calls.push(input)
    return { ok: true, outcome: (input as { outcome: string }).outcome, orderId: "o1", fulfillmentLogId: "log1" }
  },
}))

import { POST } from "@/app/api/admin/auto-fulfill/logs/[id]/reconcile/route"

const call = (body: unknown) =>
  POST(new Request("http://localhost/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), {
    params: Promise.resolve({ id: "log1" }),
  })

beforeEach(() => {
  h.auth = { ok: true, session: { user: { id: "admin1" } } }
  h.log = { orderId: "o1" }
  h.calls.length = 0
})

describe("reconcile route", () => {
  it("is admin-only", async () => {
    h.auth = { ok: false, status: 403, error: "forbidden" }
    expect((await call({ outcome: "not_exists" })).status).toBe(403)
    h.auth = { ok: false, status: 401, error: "unauthorized" }
    expect((await call({ outcome: "not_exists" })).status).toBe(401)
    expect(h.calls).toHaveLength(0)
  })

  it.each([["not json"], [{ outcome: "maybe" }], [{}], [{ outcome: "exists", supplierOrderId: "x".repeat(65) }]])(
    "refuses an invalid body (%j) with 400",
    async (body) => {
      expect((await call(body)).status).toBe(400)
      expect(h.calls).toHaveLength(0)
    }
  )

  it("an unknown log is 404", async () => {
    h.log = null
    expect((await call({ outcome: "not_exists" })).status).toBe(404)
  })

  it("passes the order of the log and the admin's id (the audit actor) to the reconciliation", async () => {
    const res = await call({ outcome: "exists", supplierOrderId: "8123456789012", note: "seen" })
    expect(res.status).toBe(200)
    expect(h.calls).toEqual([
      { orderId: "o1", outcome: "exists", supplierOrderId: "8123456789012", note: "seen", actorId: "admin1" },
    ])
  })
})
