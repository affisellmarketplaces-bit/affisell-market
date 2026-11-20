/**
 * G2 (3) — what an answer to a place-order request means. An ALLOW-LIST: only an explicit, recognised refusal is
 * "definitive"; everything else that came back from a request which may have reached AliExpress is UNCERTAIN and the order
 * is never sent again to another host / method (AliExpress may have created it). Nothing real is contacted: the sync client
 * is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  calls: [] as string[],
  strict: [] as unknown[],
  script: [] as Array<() => unknown>,
}))

vi.mock("@/lib/aliexpress-ds-sync", () => ({
  ALIEXPRESS_DS_SYNC_HOSTS: ["https://api-sg.example.test/sync", "https://api.example.test/sync"],
  callAliExpressSyncMethod: async (args: { method: string; host: string; strictHttpStatus?: boolean }) => {
    h.calls.push(`${args.method}@${args.host}`)
    h.strict.push(args.strictHttpStatus)
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
  classifyPlaceOrderAnswer,
  classifyPlaceOrderError,
  createAliExpressDsOrder,
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
const throws = (e: unknown) => () => {
  throw e
}

beforeEach(() => {
  vi.stubEnv("AE_DRY_RUN", "false")
  h.calls.length = 0
  h.strict.length = 0
  h.script.length = 0
})
afterEach(() => vi.unstubAllEnvs())

describe("classifyPlaceOrderError — only a recognised refusal is definitive", () => {
  it.each([
    ["a timeout", new AliExpressApiError("AliExpress API request timed out")],
    ["a gateway timeout worded 'timeout'", new AliExpressApiError("remote connection timeout")],
    ["an ISP remote-service error", new AliExpressApiError("Remote service error")],
    ["an ISP error with a code", new AliExpressApiError("Remote service error", { code: "isp.remote-service-timeout" })],
    ["an unreadable answer", new AliExpressApiError("AliExpress non-JSON (HTTP 502)")],
    ["a non-2xx answer", new AliExpressApiError("AliExpress HTTP 503", { code: "HTTP_503" })],
    ["a 4xx answer without a recognised refusal", new AliExpressApiError("AliExpress HTTP 400", { code: "HTTP_400" })],
    ["an unknown gateway error", new AliExpressApiError("Something we have never seen")],
    ["an empty gateway error", new AliExpressApiError("AliExpress API error")],
    ["a network reset", new TypeError("fetch failed")],
    ["a plain Error", new Error("ECONNRESET")],
    ["a thrown string", "boom"],
    // a fault message must not become a refusal because it happens to contain a business word
    ["a fault that mentions an address", new AliExpressApiError("connect to remote address refused")],
    ["a fault that mentions the price service", new AliExpressApiError("price service internal error")],
    ["a server fault that mentions stock", new AliExpressApiError("upstream server error while reading stock")],
  ])("%s is UNCERTAIN", (_l, e) => expect(classifyPlaceOrderError(e)).toBe("uncertain"))

  it.each([
    ["a stock refusal", new AliExpressApiError("INVENTORY_SHORTAGE", { code: 500 })],
    ["an out-of-stock refusal", new AliExpressApiError("Product is out of stock")],
    ["a price refusal", new AliExpressApiError("PRICE_CHANGED")],
    ["an address refusal", new AliExpressApiError("INVALID_ADDRESS")],
    ["a delivery address refusal", new AliExpressApiError("DELIVERY_ADDRESS_ERROR")],
    ["an A00 business code", new AliExpressApiError("A00123 order not allowed")],
    ["an invalid SKU", new AliExpressApiError("invalid sku")],
    ["a product offline refusal", new AliExpressApiError("PRODUCT_OFFLINE")],
    ["a shipping refusal", new AliExpressApiError("SHIPPING_NOT_SUPPORTED")],
    ["a dead token", new AliExpressApiError("IllegalAccessToken")],
  ])("%s is DEFINITIVE", (_l, e) => expect(classifyPlaceOrderError(e)).toBe("definitive"))

  it.each([
    ["an unknown method", new AliExpressApiError("isv.api-not-exist")],
    ["a missing permission", new AliExpressApiError("permission deny")],
    ["a bad signature (TOP code)", new AliExpressApiError("Invalid app Key", { code: "isv.invalid-signature" })],
    ["a bad timestamp", new AliExpressApiError("The timestamp is invalid")],
  ])("%s lets the NEXT method try (rejected before processing)", (_l, e) =>
    expect(classifyPlaceOrderError(e)).toBe("try_next_method")
  )

  it.each([
    ["the explicit rate-limit flag", new AliExpressApiError("whatever", { rateLimited: true })],
    ["a throttling message", new AliExpressApiError("Too many requests")],
  ])("%s is RATE_LIMITED", (_l, e) => expect(classifyPlaceOrderError(e)).toBe("rate_limited"))

  // The review's own examples: a platform fault worded with camelCase exception names, "time out", "degraded"… that also
  // contains a business word must stay UNCERTAIN.
  it.each([
    ["ReadTimeoutException: stock check failed", {}],
    ["SocketTimeoutException while locking inventory", {}],
    ["Read time out while reserving inventory", {}],
    ["Service degraded, retry later: price service down", {}],
    ["Maximum retries exceeded for address lookup", {}],
    ["inventory", { code: "ServiceUnavailable" }],
    ["Under maintenance: price list unavailable", {}],
    ["System overloaded while checking stock", {}],
    ["NullPointerException in address validator", {}],
  ])("a platform fault that contains a business word stays UNCERTAIN: %s", (message, extra) => {
    expect(classifyPlaceOrderAnswer({ message, ...extra })).toBe("uncertain")
  })

  it("classifies on EVERY field of the answer, never on the first non-empty one", () => {
    // {error_code: "A001", error_msg: "remote service timeout"}: judged on 'A001' alone it was "definitive"
    expect(classifyPlaceOrderAnswer({ message: "A001", detail: "A001 | remote service timeout" })).toBe("uncertain")
    expect(classifyPlaceOrderAnswer({ message: "A001", detail: "A001 | order not allowed" })).toBe("definitive")
    expect(classifyPlaceOrderAnswer({ message: "failed", detail: "failed | INVENTORY_SHORTAGE" })).toBe("definitive")
  })

  it("an ISP (platform fault) envelope is UNCERTAIN whatever its text says", () => {
    expect(classifyPlaceOrderAnswer({ message: "price check failed", gatewayType: "ISP" })).toBe("uncertain")
    expect(classifyPlaceOrderAnswer({ message: "INVENTORY_SHORTAGE", gatewayType: "ISP" })).toBe("uncertain")
    // an ISV (caller) envelope is read on its words
    expect(classifyPlaceOrderAnswer({ message: "INVENTORY_SHORTAGE", gatewayType: "ISV" })).toBe("definitive")
    expect(classifyPlaceOrderError(new AliExpressApiError("price check failed", { gatewayType: "ISP" }))).toBe("uncertain")
  })

  it.each([
    ["HTTP 429 (throttled at the door)", new AliExpressApiError("AliExpress HTTP 429", { code: "HTTP_429" }), "rate_limited"],
    ["HTTP 403", new AliExpressApiError("AliExpress HTTP 403", { code: "HTTP_403" }), "try_next_method"],
    ["HTTP 404", new AliExpressApiError("AliExpress HTTP 404", { code: "HTTP_404" }), "try_next_method"],
    ["HTTP 500 stays uncertain", new AliExpressApiError("AliExpress HTTP 500", { code: "HTTP_500" }), "uncertain"],
    ["TOP throttle", new AliExpressApiError("This ban will last for 1 more seconds", { code: "accesscontrol.limited-by-api-access-count" }), "rate_limited"],
    ["'Api call limit exceeded'", new AliExpressApiError("Api call limit exceeded"), "rate_limited"],
    ["a DNS failure (nothing was sent)", Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }), "try_next_method"],
    ["a refused connection (nothing was sent)", Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }), "try_next_method"],
    ["a connection RESET (the request may have left)", Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }), "uncertain"],
    ["a socket timeout (the request may have left)", Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } }), "uncertain"],
    ["Invalid mobile number", new AliExpressApiError("Invalid mobile number"), "definitive"],
    ["Invalid postal code", new AliExpressApiError("Invalid postal code"), "definitive"],
    ["Shipping method not available for this country", new AliExpressApiError("Shipping method not available for this country"), "definitive"],
  ])("%s => %s", (_l, e, expected) => expect(classifyPlaceOrderError(e)).toBe(expected))

  it("a word like 'rate' or 'limit' alone is NOT a throttle (an inventory limit is a stock refusal)", () => {
    expect(classifyPlaceOrderAnswer({ message: "INVENTORY_LIMIT_REACHED" })).toBe("definitive")
    expect(classifyPlaceOrderAnswer({ message: "generate failed" })).toBe("uncertain")
  })
})

describe("createAliExpressDsOrder — an unreadable answer is never sent again", () => {
  it.each([
    ["timeout", throws(new AliExpressApiError("AliExpress API request timed out"))],
    ["gateway 'timeout' wording", throws(new AliExpressApiError("remote connection timeout"))],
    ["ISP 'Remote service error'", throws(new AliExpressApiError("Remote service error"))],
    ["ISV error of unknown text", throws(new AliExpressApiError("Unexpected ISV failure", { code: "isv.unexpected" }))],
    ["non-2xx (HTTP 503)", throws(new AliExpressApiError("AliExpress HTTP 503", { code: "HTTP_503" }))],
    ["network error", throws(new TypeError("fetch failed"))],
    ["non-JSON answer", throws(new AliExpressApiError("AliExpress non-JSON (HTTP 504)"))],
    ["2xx without an order id and without an error code", () => ({ aliexpress_trade_buy_placeorder_response: { result: { is_success: false } } })],
    ["2xx with an empty body", () => ({})],
    ["2xx whose error text is unknown", () => ({ aliexpress_trade_buy_placeorder_response: { result: { error_msg: "SOMETHING_ODD" } } })],
  ])("%s on the FIRST request => ONE request, flagged uncertain", async (_l, first) => {
    h.script.push(first as () => unknown)
    // If the code (wrongly) went on, the next request would succeed — and the order would exist twice.
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.outcomeUncertain).toBe(true)
    expect(h.calls).toHaveLength(1)
    expect(r.methodAttempts).toHaveLength(1)
  })

  it("the second request is not sent either after a 'method unavailable' first answer that itself was unreadable", async () => {
    h.script.push(throws(new AliExpressApiError("isv.api-not-exist"))) // rejected before processing: next method may try
    h.script.push(throws(new AliExpressApiError("Remote service error"))) // reached AliExpress, unreadable: STOP
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: false, outcomeUncertain: true })
    expect(h.calls).toHaveLength(2)
  })

  it("asks the sync client to treat a non-2xx status as an error (strictHttpStatus)", async () => {
    h.script.push(() => OK_PAYLOAD)
    await createAliExpressDsOrder(input)
    expect(h.strict).toEqual([true])
  })

  it("the uncertain flag survives the legacy auto-buy wrapper", async () => {
    h.script.push(throws(new AliExpressApiError("Remote service error")))
    const r = await placeAliExpressDsOrder({
      aeProductId: input.supplierProductId,
      aeSkuId: input.skuId,
      quantity: 1,
      shippingAddress: { name: "Test Buyer", line1: "1 rue de la Paix", city: "Paris", postal_code: "75001", country: "FR", phone: "33612345678" },
    })
    expect(r).toMatchObject({ ok: false, outcomeUncertain: true })
  })
})

describe("createAliExpressDsOrder — recognised answers keep their behaviour", () => {
  it("an explicit business refusal (thrown) => definitive, ONE request, no resend", async () => {
    h.script.push(throws(new AliExpressApiError("INVENTORY_SHORTAGE", { code: 500 })))
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: false, error: "INVENTORY_SHORTAGE" })
    if (!r.ok) expect(r.outcomeUncertain).toBeUndefined()
    expect(h.calls).toHaveLength(1)
  })

  it("an explicit business refusal in a 2xx body => definitive, ONE request", async () => {
    h.script.push(() => ({ aliexpress_trade_buy_placeorder_response: { result: { error_code: "INVALID_ADDRESS" } } }))
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: false, error: "INVALID_ADDRESS" })
    if (!r.ok) expect(r.outcomeUncertain).toBeUndefined()
    expect(h.calls).toHaveLength(1)
  })

  it("2xx body {error_code: 'A001', error_msg: 'remote service timeout'}: judged on BOTH fields => uncertain, ONE request", async () => {
    h.script.push(() => ({
      aliexpress_trade_buy_placeorder_response: { result: { error_code: "A001", error_msg: "remote service timeout" } },
    }))
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: false, outcomeUncertain: true })
    expect(h.calls).toHaveLength(1)
  })

  it("a DNS failure on the first host (nothing was sent) lets the next host try", async () => {
    h.script.push(throws(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })))
    h.script.push(() => OK_PAYLOAD)
    expect(await createAliExpressDsOrder(input)).toMatchObject({ ok: true, aliexpressOrderId: "9876543210" })
    expect(h.calls).toHaveLength(2)
  })

  it("HTTP 429 backs off and tries again (nothing was processed)", async () => {
    vi.useFakeTimers()
    try {
      h.script.push(throws(new AliExpressApiError("AliExpress HTTP 429", { code: "HTTP_429" })))
      h.script.push(() => OK_PAYLOAD)
      const pending = createAliExpressDsOrder(input)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(await pending).toMatchObject({ ok: true, aliexpressOrderId: "9876543210" })
      expect(h.calls.length).toBeGreaterThanOrEqual(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("a gateway 'method unavailable' refusal falls through to the next method, and a success is returned", async () => {
    h.script.push(throws(new AliExpressApiError("isv.api-not-exist")))
    h.script.push(() => OK_PAYLOAD)
    const r = await createAliExpressDsOrder(input)
    expect(r).toMatchObject({ ok: true, aliexpressOrderId: "9876543210" })
    expect(h.calls).toHaveLength(2)
  })

  it("only 'method unavailable' refusals => final failure is NOT flagged uncertain (nothing was ever processed)", async () => {
    for (let i = 0; i < 8; i++) h.script.push(throws(new AliExpressApiError("isv.api-not-exist")))
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
