import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAliExpressDsOrder } from "@/lib/aliexpress-ds-create-order"
import {
  guardSupplierPurchase,
  setSupplierPurchaseClaimStoreForTests,
  supplierPurchaseKeysHeld,
  type ClaimStore,
} from "@/lib/supplier-purchase/guard.server"
import { memoryClaimStore } from "@/lib/supplier-purchase/memory-claim-store"
import { anySupplierPurchaseAllowed, supplierPurchaseDecision } from "@/lib/supplier-purchase/policy"
import { isCjAnsweredRefusal, CjDropshippingSupplierAdapter } from "@/lib/suppliers/adapters/cj-dropshipping.adapter"
import { RestSupplierAdapter } from "@/lib/suppliers/rest-adapter"

const ON = { SUPPLIER_PURCHASES_ENABLED: "true", SUPPLIER_PURCHASE_CHANNELS: "aliexpress,cj,partner_rest" }

describe("supplierPurchaseDecision — fail-closed", () => {
  it("nothing set → refused (the production default)", () => {
    expect(supplierPurchaseDecision({}, "aliexpress")).toMatchObject({ allowed: false, reason: "master_switch_absent" })
    expect(anySupplierPurchaseAllowed({})).toBe(false)
  })

  it("only the exact activation allows", () => {
    expect(supplierPurchaseDecision(ON, "aliexpress").allowed).toBe(true)
    expect(supplierPurchaseDecision({ ...ON, SUPPLIER_PURCHASE_CHANNELS: "aliexpress, cj" }, "cj").allowed).toBe(true)
  })

  it.each([["True"], ["TRUE"], ["1"], ["yes"], ["on"], [" true"], ["true "], ["truee"], ["false"]])(
    "master switch %j → refused",
    (v) => {
      expect(supplierPurchaseDecision({ ...ON, SUPPLIER_PURCHASES_ENABLED: v }, "aliexpress")).toMatchObject({
        allowed: false,
        reason: "master_switch_invalid",
      })
    },
  )

  it.each([[""], ["AliExpress"], ["aliexpres"], ["aliexpress,"], ["aliexpress,,cj"], ["*"], ["all"]])(
    "channels %j → refused for every channel (ambiguous list)",
    (v) => {
      const d = supplierPurchaseDecision({ ...ON, SUPPLIER_PURCHASE_CHANNELS: v }, "aliexpress")
      expect(d.allowed).toBe(false)
    },
  )

  it("a channel not listed is refused, the listed one is allowed", () => {
    const env = { ...ON, SUPPLIER_PURCHASE_CHANNELS: "cj" }
    expect(supplierPurchaseDecision(env, "aliexpress")).toMatchObject({ allowed: false, reason: "channel_not_enabled" })
    expect(supplierPurchaseDecision(env, "cj").allowed).toBe(true)
  })

  it.each([
    ["DISABLE_AUTO_BUY", "true", "kill_switch_disable_auto_buy"],
    ["DISABLE_AUTO_BUY", "1", "kill_switch_disable_auto_buy"],
    ["DISABLE_AUTO_BUY", "False", "kill_switch_disable_auto_buy"],
    ["AUTO_ORDER_ENABLED", "false", "kill_switch_auto_order_enabled"],
    ["AUTO_ORDER_ENABLED", "0", "kill_switch_auto_order_enabled"],
    ["AUTO_ORDER_ENABLED", "off", "kill_switch_auto_order_enabled"],
    ["AUTO_ORDER_ENABLED", "TRUE", "kill_switch_auto_order_enabled"],
  ])("legacy %s=%j still stops everything", (name, value, reason) => {
    expect(supplierPurchaseDecision({ ...ON, [name]: value }, "aliexpress")).toMatchObject({ allowed: false, reason })
  })
})

describe("guardSupplierPurchase — at most once per key", () => {
  let store: ReturnType<typeof memoryClaimStore>
  beforeEach(() => {
    store = memoryClaimStore()
  })
  const g = (send: () => Promise<never> | Promise<unknown>, keys = ["order:o1"], env: Record<string, string> = ON) =>
    guardSupplierPurchase({ channel: "aliexpress", path: "test", keys, env, store }, send as never)

  it("policy closed → the send function is never called", async () => {
    const send = vi.fn()
    expect((await g(send, ["order:o1"], {})).kind).toBe("blocked")
    expect(send).not.toHaveBeenCalled()
    expect(store.rows.size).toBe(0)
  })

  it("two concurrent calls for the same order → exactly one send", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const send = vi.fn(async () => {
      await gate
      return { kind: "placed", supplierOrderId: "ae_1", value: "v" }
    })
    const a = g(send)
    const b = g(send)
    release()
    const results = (await Promise.all([a, b])).map((r) => r.kind).sort()
    expect(send).toHaveBeenCalledTimes(1)
    expect(results).toEqual(["in_flight_or_uncertain", "sent"])
  })

  it("placed → a retry gets the stored id back, nothing re-sent", async () => {
    await g(async () => ({ kind: "placed", supplierOrderId: "ae_1", value: 1 }))
    const send = vi.fn()
    expect(await g(send)).toEqual({ kind: "already_placed", supplierOrderId: "ae_1" })
    expect(send).not.toHaveBeenCalled()
  })

  it("rejected → may be tried again (the only re-claimable state)", async () => {
    await g(async () => ({ kind: "rejected", error: "ADDRESS", value: 1 }))
    const send = vi.fn(async () => ({ kind: "placed", supplierOrderId: "ae_2", value: 2 }))
    expect((await g(send)).kind).toBe("sent")
    expect(store.rows.get("order:o1")).toMatchObject({ status: "placed", attempts: 2 })
  })

  it("uncertain (or a throw) → refused forever, until a human decides", async () => {
    await g(async () => ({ kind: "uncertain", error: "timeout", value: 1 }))
    const send = vi.fn()
    expect((await g(send)).kind).toBe("in_flight_or_uncertain")
    await expect(g(async () => Promise.reject(new Error("socket hang up")), ["order:o2"])).rejects.toThrow(
      "socket hang up",
    )
    expect(store.rows.get("order:o2")?.status).toBe("uncertain")
    expect((await g(send, ["order:o2"])).kind).toBe("in_flight_or_uncertain")
    expect(send).not.toHaveBeenCalled()
  })

  it("multi-order supplier order: all keys or none", async () => {
    await g(async () => ({ kind: "placed", supplierOrderId: "x", value: 1 }), ["order:o2"])
    const send = vi.fn()
    expect((await g(send, ["order:o1", "order:o2"])).kind).toBe("in_flight_or_uncertain")
    expect(store.rows.has("order:o1")).toBe(false) // nothing half-claimed
    expect(send).not.toHaveBeenCalled()
  })

  it("claim store down → refused, never sent", async () => {
    const broken: ClaimStore = {
      tryClaimAll: async () => Promise.reject(new Error('relation "SupplierPurchaseClaim" does not exist')),
      readAll: async () => Promise.reject(new Error("connection refused")),
      settleAll: async () => {},
    }
    const send = vi.fn()
    const r = await guardSupplierPurchase(
      { channel: "cj", path: "t", keys: ["order:o1"], env: ON, store: broken },
      send,
    )
    expect(r.kind).toBe("claim_store_unavailable")
    expect(send).not.toHaveBeenCalled()
    expect((await supplierPurchaseKeysHeld(["order:o1"], broken)).held).toBe(true) // fail-closed pre-check
  })

  it("empty key → refused", async () => {
    const send = vi.fn()
    expect((await g(send, [" "])).kind).toBe("claim_store_unavailable")
    expect(send).not.toHaveBeenCalled()
  })
})

// ---------- AliExpress DS (paths A/B/C/D/E/F all end here) ----------
const aeEnv = () => {
  vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
  vi.stubEnv("ALIEXPRESS_APP_SECRET", "test_secret_value_here")
  vi.stubEnv("ALIEXPRESS_ACCESS_TOKEN", "access_tok")
  vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "refresh_tok")
  vi.stubEnv("ALIEXPRESS_ACCESS_EXPIRES_AT", String(Date.now() + 12 * 60 * 60 * 1000))
  vi.stubEnv("ALIEXPRESS_ENV", "sandbox")
  vi.stubEnv("AE_DRY_RUN", "false")
  vi.stubEnv("ENCRYPTION_KEY", "")
}
const aeInput = (key = "order:o1") => ({
  supplierProductId: "1005007291234567",
  skuId: "14:200003699#Black",
  quantity: 1,
  shippingAddress: {
    name: "Test Buyer",
    phone: "33612345678",
    address1: "1 rue de la Paix",
    city: "Paris",
    zip: "75001",
    countryCode: "FR",
  },
  purchaseKeys: [key],
  purchasePath: "test",
})
const placed = (id: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      aliexpress_trade_buy_placeorder_response: { result: { is_success: true, order_list: { number: [id] } } },
    }),
})

describe("createAliExpressDsOrder — guarded", () => {
  let store: ReturnType<typeof memoryClaimStore>
  let fetchMock: ReturnType<typeof vi.fn>
  const placeCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/sync?")).length

  beforeEach(async () => {
    aeEnv()
    store = memoryClaimStore()
    setSupplierPurchaseClaimStoreForTests(store)
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { clearAliExpressTokenMemoryCache } = await import("@/lib/aliexpress-oauth")
    clearAliExpressTokenMemoryCache()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    setSupplierPurchaseClaimStoreForTests(null)
  })

  it("default env (no activation) → refused before any network call", async () => {
    const r = await createAliExpressDsOrder(aeInput())
    expect(r).toMatchObject({ ok: false, error: "supplier_purchase_blocked:master_switch_absent" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("AUTO_ORDER_ENABLED=false (the documented disable) also blocks the ops route path", async () => {
    vi.stubEnv("SUPPLIER_PURCHASES_ENABLED", "true")
    vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "aliexpress")
    vi.stubEnv("AUTO_ORDER_ENABLED", "false")
    expect((await createAliExpressDsOrder(aeInput())).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe("enabled", () => {
    beforeEach(() => {
      vi.stubEnv("SUPPLIER_PURCHASES_ENABLED", "true")
      vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "aliexpress")
    })

    it("a timeout on the first call stops: ONE place-order request, and a retry sends nothing", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (String(url).includes("/sync?")) throw new Error("The operation was aborted due to timeout")
        return { ok: false, status: 404, text: async () => "" }
      })
      const r = await createAliExpressDsOrder(aeInput())
      expect(r).toMatchObject({ ok: false, uncertain: true })
      expect(placeCalls()).toBe(1) // before: up to 8 (2 attempts × 2 hosts × 2 methods)
      const again = await createAliExpressDsOrder(aeInput())
      expect(again).toMatchObject({ ok: false, uncertain: true })
      expect(placeCalls()).toBe(1)
    })

    it("'method not available' answers fall through to the next method; the success is recorded", async () => {
      let n = 0
      fetchMock.mockImplementation(async (url: string) => {
        if (!String(url).includes("/sync?")) return { ok: false, status: 404, text: async () => "" }
        n += 1
        if (n === 1)
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ error_response: { code: "InvalidApiPath", msg: "isv.api-not-exist" } }),
          }
        return placed("111")
      })
      const r = await createAliExpressDsOrder(aeInput())
      expect(r).toMatchObject({ ok: true, aliexpressOrderId: "111" })
      expect(store.rows.get("order:o1")).toMatchObject({ status: "placed", supplierOrderId: "111" })
    })

    it("same order from another path (auto-buy then manual fulfil) → stored id, no second purchase", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes("/sync?") ? placed("222") : { ok: false, status: 404, text: async () => "" },
      )
      await createAliExpressDsOrder({ ...aeInput(), purchasePath: "auto-buy" })
      const before = placeCalls()
      const second = await createAliExpressDsOrder({ ...aeInput(), purchasePath: "aliexpress-fulfill-order" })
      expect(second).toMatchObject({ ok: true, aliexpressOrderId: "222", method: "claim_replay" })
      expect(placeCalls()).toBe(before)
    })

    it("a business refusal is final for this call: no other host receives the same order", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes("/sync?")
          ? {
              ok: true,
              status: 200,
              text: async () =>
                JSON.stringify({
                  aliexpress_trade_buy_placeorder_response: {
                    result: { is_success: false, error_code: "B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL" },
                  },
                }),
            }
          : { ok: false, status: 404, text: async () => "" },
      )
      const r = await createAliExpressDsOrder(aeInput())
      expect(r.ok).toBe(false)
      expect(placeCalls()).toBe(1)
      expect(store.rows.get("order:o1")?.status).toBe("rejected")
    })

    it("no purchase key → refused", async () => {
      expect(await createAliExpressDsOrder({ ...aeInput(), purchaseKeys: [] })).toMatchObject({
        error: "supplier_purchase_missing_key",
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})

// ---------- CJ ----------
describe("CJ adapter — guarded", () => {
  const ctx = {
    id: "p_cj",
    slug: "cj",
    name: "CJ",
    type: "CJ_DROPSHIPPING",
    apiConfig: { email: "ops@affisell.test", apiKey: "k" },
    credentialsEncrypted: null,
    slaHours: 48,
  } as never
  const dto = {
    reference: "afb-1-1",
    shipping: { name: "J", line1: "1", city: "Paris", postal_code: "75001", country: "FR" },
    lines: [{ sku: "v", quantity: 1, unitCostCents: 500, unitPriceCents: 1200 }],
    purchaseKeys: ["order:o9"],
  }
  const res = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => "" })
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    setSupplierPurchaseClaimStoreForTests(memoryClaimStore())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    setSupplierPurchaseClaimStoreForTests(null)
  })
  const createCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("createOrderV2")).length
  const payCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/shopping/pay/payment")).length

  it("default env → no order created, nothing paid", async () => {
    fetchMock.mockResolvedValue(res({ result: true, data: { accessToken: "t", orderId: "x" } }))
    const r = await new CjDropshippingSupplierAdapter(ctx).placeOrder(dto)
    expect(r.errorMessage).toBe("supplier_purchase_blocked:master_switch_absent")
    expect(createCalls() + payCalls()).toBe(0)
  })

  it("a 5xx on create is uncertain: the batch re-run does NOT create (or pay) a second order", async () => {
    vi.stubEnv("SUPPLIER_PURCHASES_ENABLED", "true")
    vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "cj")
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("getAccessToken")) return res({ result: true, data: { accessToken: "t" } })
      return res({ result: false, message: "gateway" }, false, 502)
    })
    const adapter = new CjDropshippingSupplierAdapter({ ...(ctx as object), id: "p_cj2" } as never)
    expect((await adapter.placeOrder(dto)).errorMessage).toContain("uncertain:")
    expect((await adapter.placeOrder(dto)).errorMessage).toContain("supplier_purchase_in_flight_or_uncertain")
    expect(createCalls()).toBe(1)
  })

  it("isCjAnsweredRefusal: 4xx and result=false are refusals, 5xx / timeouts are not", () => {
    expect(isCjAnsweredRefusal("cj_request_failed:/shopping/order/createOrderV2:400:invalid_vid")).toBe(true)
    expect(isCjAnsweredRefusal("cj_request_failed:/shopping/order/createOrderV2:200:bad")).toBe(true)
    expect(isCjAnsweredRefusal("cj_request_failed:/shopping/order/createOrderV2:503:x")).toBe(false)
    expect(isCjAnsweredRefusal("The operation was aborted due to timeout")).toBe(false)
  })
})

// ---------- Partner REST (path G, blind dropship) ----------
describe("RestSupplierAdapter.createOrder — guarded", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ supplier_order_id: "p_1" }),
      text: async () => "",
    }))
    vi.stubGlobal("fetch", fetchMock)
    setSupplierPurchaseClaimStoreForTests(memoryClaimStore())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    setSupplierPurchaseClaimStoreForTests(null)
  })
  const input = {
    shipping: {} as never,
    items: [{ sku: "s", quantity: 1, unit_price_cents: 100 }],
    contact_email: "c@x.test",
    reference: "bd-1",
    purchaseKeys: ["blind:1:sup_a"],
  }

  it("default env → throws the refusal, no HTTP call", async () => {
    await expect(new RestSupplierAdapter("https://partner.test", "k", {}).createOrder(input)).rejects.toThrow(
      "supplier_purchase_blocked",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("Inngest step retry after success → stored id, partner called once", async () => {
    vi.stubEnv("SUPPLIER_PURCHASES_ENABLED", "true")
    vi.stubEnv("SUPPLIER_PURCHASE_CHANNELS", "partner_rest")
    const a = new RestSupplierAdapter("https://partner.test", "k", {})
    expect(await a.createOrder(input)).toEqual({ supplier_order_id: "p_1" })
    expect(await a.createOrder(input)).toEqual({ supplier_order_id: "p_1" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ---------- Other spending paths: browser checkout + its card, China agents, supplier payment ----------
describe("other spending paths are closed by default", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("AliExpress browser checkout", async () => {
    vi.stubEnv("AE_BROWSER_AUTOMATION_ENABLED", "true")
    const { runAliExpressBrowserCheckout } = await import("@/lib/fulfillment/ae-browser-checkout")
    const r = await runAliExpressBrowserCheckout({
      aeUrl: "https://aliexpress.test/item",
      aeSkuId: null,
      shippingAddress: { name: "x" } as never,
      cardNumber: "4000",
      cardExpMonth: 1,
      cardExpYear: 2030,
      cardCvc: "1",
      purchaseKeys: ["order:o1"],
      purchasePath: "t",
    })
    expect(r).toMatchObject({ ok: false, error: "supplier_purchase_blocked:master_switch_absent" })
  })

  it("Stripe Issuing virtual card (the money that pays AliExpress)", async () => {
    vi.stubEnv("STRIPE_ISSUING_CARDHOLDER_ID", "ich_test")
    const { createAutoBuyVirtualCard } = await import("@/lib/fulfillment/stripe-issuing-card")
    expect(await createAutoBuyVirtualCard(1000)).toMatchObject({
      ok: false,
      error: "supplier_purchase_blocked:master_switch_absent",
    })
  })

  it("China buying agents with a configured API key", async () => {
    vi.stubEnv("SUPERBUY_API_KEY", "k")
    vi.stubEnv("ANOVABUY_API_KEY", "k")
    const { routeSuperbuyItem } = await import("@/lib/china-buying/adapters/superbuy")
    const { routeAnovabuyItem } = await import("@/lib/china-buying/adapters/anovabuy")
    const args = { sourceUrl: "https://1688.test/x", platform: null, quantity: 1 }
    expect(await routeSuperbuyItem(args)).toMatchObject({ ok: false })
    expect(await routeAnovabuyItem(args)).toMatchObject({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("early gates: auto-buy off, nothing queued", async () => {
    const { isAutoBuyDisabled, isAnySupplierPurchaseAllowed } = await import("@/lib/fulfillment/auto-buy")
    expect(isAutoBuyDisabled()).toBe(true)
    expect(isAnySupplierPurchaseAllowed()).toBe(false)
    vi.stubEnv("REDIS_URL", "redis://x")
    const { isAutoOrderQueueEnabled } = await import("@/lib/auto-order/redis")
    expect(isAutoOrderQueueEnabled()).toBe(false)
  })
})
