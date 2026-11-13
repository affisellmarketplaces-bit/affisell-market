/**
 * POST /api/aliexpress/order/create has no claim (no order id): its caller is the only protection against a second order. An
 * UNCERTAIN outcome must not look like a plain failure (502 = "retry").
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ result: {} as Record<string, unknown>, ops: [] as string[] }))

vi.mock("@/lib/aliexpress-ds-create-order", () => ({ createAliExpressDsOrder: async () => h.result }))
vi.mock("@/lib/aliexpress-ops-auth", () => ({
  authorizeAliExpressOps: () => null,
  extractBodySecret: () => undefined,
  stripBodySecret: (v: unknown) => v,
}))
vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: async (t: string) => {
    h.ops.push(t)
    return { slack: true, discord: false }
  },
}))

import { POST } from "@/app/api/aliexpress/order/create/route"

const body = {
  supplierProductId: "1005007291234567",
  skuId: "12000012345678901",
  quantity: 1,
  shippingAddress: {
    name: "Test Buyer",
    phone: "33612345678",
    address1: "1 rue de la Paix",
    city: "Paris",
    zip: "75001",
    countryCode: "FR",
  },
}
const call = () => POST(new Request("http://localhost/api/aliexpress/order/create", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  h.ops.length = 0
})

describe("POST /api/aliexpress/order/create", () => {
  it("an UNCERTAIN outcome is a 409 that says 'verify at AliExpress first', flagged outcomeUncertain, and alerts ops — never a retryable 502", async () => {
    h.result = { ok: false, error: "AliExpress API request timed out", methodAttempts: ["m#1"], outcomeUncertain: true }
    const res = await call()
    expect(res.status).toBe(409)
    const json = (await res.json()) as Record<string, unknown>
    expect(json).toMatchObject({ ok: false, outcomeUncertain: true })
    expect(String(json.message)).toContain("AVANT toute nouvelle tentative")
    await Promise.resolve()
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]).toContain("INCERTAINE")
  })

  it("a definitive refusal stays a 502 without the flag (unchanged)", async () => {
    h.result = { ok: false, error: "INVENTORY_SHORTAGE", methodAttempts: ["m#1"] }
    const res = await call()
    expect(res.status).toBe(502)
    expect(((await res.json()) as Record<string, unknown>).outcomeUncertain).toBeUndefined()
    expect(h.ops).toHaveLength(0)
  })

  it("a success is a 200 (unchanged)", async () => {
    h.result = { ok: true, aliexpressOrderId: "9876543210", trackingPreview: null, method: "m#1" }
    expect((await call()).status).toBe(200)
  })
})
