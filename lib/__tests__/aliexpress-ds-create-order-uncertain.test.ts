/**
 * G2 (3) — a request that left and came back with an unknown outcome must NOT be sent again to another host / method:
 * AliExpress may have created the order on the first one. Nothing real is contacted: the sync client is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ calls: [] as string[], script: [] as Array<() => unknown> }))

vi.mock("@/lib/aliexpress-ds-sync", () => ({
  ALIEXPRESS_DS_SYNC_HOSTS: ["https://api-sg.example.test/sync", "https://api.example.test/sync"],
  callAliExpressSyncMethod: async (args: { method: string; host: string }) => {
    h.calls.push(`${args.method}@${args.host}`)
    const next = h.script.shift()
    if (!next) throw new Error("script exhausted")
    return next()
  },
}))
vi.mock("@/lib/aliexpress-oauth", () => ({ getValidAccessToken: async () => "token" }))
vi.mock("@/lib/aliexpress-config", () => ({ readAliExpressConfig: () => ({ appKey: "k", appSecret: "s" }) }))
vi.mock("@/lib/aliexpress-open-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/aliexpress-open-api")>()
  return { ...real, AliExpressClient: { isConfigured: () => true } }
})

import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import {
  createAliExpressDsOrder,
  isAmbiguousPlaceOrderError,
  placeAliExpressDsOrder,
} from "@/lib/aliexpress-ds-create-order"

const input = {
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

const OK_PAYLOAD = { aliexpress_trade_buy_placeorder_response: { result: { is_success: true, order_list: { number: ["9876543210"] } } } }

beforeEach(() => {
  vi.stubEnv("AE_DRY_RUN", "false")
  h.calls.length = 0
  h.script.length = 0
})
afterEach(() => vi.unstubAllEnvs())

describe("isAmbiguousPlaceOrderError", () => {
  it.each([
    ["a timeout", new AliExpressApiError("AliExpress API request timed out")],
    ["an unreadable answer", new AliExpressApiError("AliExpress non-JSON (HTTP 502)")],
    ["a network reset", new TypeError("fetch failed")],
    ["a plain Error", new Error("ECONNRESET")],
    ["a thrown string", "boom"],
  ])("%s is ambiguous", (_l, e) => expect(isAmbiguousPlaceOrderError(e)).toBe(true))

  it.each([
    ["a gateway refusal", new AliExpressApiError("isv.api-not-exist")],
    ["a business refusal", new AliExpressApiError("INVENTORY_SHORTAGE", { code: 500 })],
    ["a rate limit", new AliExpressApiError("Too many requests", { rateLimited: true })],
  ])("%s is a definitive answer", (_l, e) => expect(isAmbiguousPlaceOrderError(e)).toBe(false))
})

describe("createAliExpressDsOrder — outcome unknown", () => {
  it.each([
    ["timeout", () => new AliExpressApiError("AliExpress API request timed out")],
    ["network error", () => new TypeError("fetch failed")],
    ["non-JSON answer", () => new AliExpressApiError("AliExpress non-JSON (HTTP 504)")],
  ])("%s on the FIRST request => ONE request only, flagged uncertain (no resend on another host/method)", async (_l, makeErr) => {
    h.script.push(() => {
      throw makeErr()
    })
    // If the code (wrongly) went on, the next request would succeed — and the order would exist twice.
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.outcomeUncertain).toBe(true)
    expect(h.calls).toHaveLength(1)
    expect(r.methodAttempts).toHaveLength(1)
  })

  it("the uncertain flag survives the legacy auto-buy wrapper", async () => {
    h.script.push(() => {
      throw new AliExpressApiError("AliExpress API request timed out")
    })
    const r = await placeAliExpressDsOrder({
      aeProductId: input.supplierProductId,
      aeSkuId: input.skuId,
      quantity: 1,
      shippingAddress: { name: "Test Buyer", line1: "1 rue de la Paix", city: "Paris", postal_code: "75001", country: "FR", phone: "33612345678" },
    })
    expect(r).toMatchObject({ ok: false, outcomeUncertain: true })
  })
})

describe("createAliExpressDsOrder — definitive answers keep their behaviour", () => {
  it("a gateway 'method unavailable' refusal still falls through to the next method, and a success is returned", async () => {
    h.script.push(() => {
      throw new AliExpressApiError("isv.api-not-exist")
    })
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: true, aliexpressOrderId: "9876543210" })
    expect(h.calls).toHaveLength(2)
  })

  it("only definitive refusals => final failure is NOT flagged uncertain", async () => {
    for (let i = 0; i < 8; i++) {
      h.script.push(() => {
        throw new AliExpressApiError("isv.api-not-exist")
      })
    }
    const r = await createAliExpressDsOrder(input)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.outcomeUncertain).toBeUndefined()
    expect(h.calls.length).toBeGreaterThan(1)
  })

  it("a first-try success is untouched", async () => {
    h.script.push(() => OK_PAYLOAD)
    expect(await createAliExpressDsOrder(input)).toMatchObject({ ok: true, aliexpressOrderId: "9876543210" })
    expect(h.calls).toHaveLength(1)
  })

  it("a pre-flight failure (no product id) sends nothing and is definitive", async () => {
    const r = await createAliExpressDsOrder({ ...input, supplierProductId: "  " })
    expect(r).toMatchObject({ ok: false, error: "missing_product_or_sku" })
    expect(h.calls).toHaveLength(0)
    if (!r.ok) expect(r.outcomeUncertain).toBeUndefined()
  })
})
