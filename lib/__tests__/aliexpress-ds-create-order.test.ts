import { afterEach, describe, expect, it, vi } from "vitest"

import { createAliExpressDsOrder } from "@/lib/aliexpress-ds-create-order"

describe("createAliExpressDsOrder payload", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("posts official place-order DTO with sha256 sync signing", async () => {
    vi.stubEnv("ALIEXPRESS_APP_KEY", "534690")
    vi.stubEnv("ALIEXPRESS_APP_SECRET", "test_secret_value_here")
    vi.stubEnv("ALIEXPRESS_ACCESS_TOKEN", "access_tok")
    vi.stubEnv("ALIEXPRESS_REFRESH_TOKEN", "refresh_tok")
    vi.stubEnv("ALIEXPRESS_ACCESS_EXPIRES_AT", String(Date.now() + 12 * 60 * 60 * 1000))
    vi.stubEnv("ALIEXPRESS_ENV", "sandbox")
    vi.stubEnv("AE_DRY_RUN", "false")
    vi.stubEnv("ENCRYPTION_KEY", "")

    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes("/auth/token/refresh")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: "access_tok",
              refresh_token: "refresh_tok",
              expires_in: 86400,
            }),
        }
      }
      if (!u.includes("/sync?")) {
        return { ok: false, status: 404, text: async () => "" }
      }
      expect(u).toContain("sign_method=sha256")
      expect(u).toContain("param_place_order_request4_open_api_d_t_o=")
      expect(u).not.toContain("+")
      const decoded = decodeURIComponent(u)
      expect(decoded).toContain('"product_items"')
      expect(decoded).toContain('"logistics_address"')
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            aliexpress_trade_buy_placeorder_response: {
              result: {
                is_success: true,
                order_list: { number: ["9876543210"] },
              },
            },
          }),
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    const { clearAliExpressTokenMemoryCache } = await import("@/lib/aliexpress-oauth")
    clearAliExpressTokenMemoryCache()

    const result = await createAliExpressDsOrder({
      supplierProductId: "1005007291234567",
      skuId: "14:200003699#Black",
      quantity: 1,
      shippingAddress: {
        name: "Nelson Test",
        phone: "33612345678",
        address1: "1 rue de la Paix",
        city: "Paris",
        zip: "75001",
        countryCode: "FR",
        state: "IDF",
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.aliexpressOrderId).toBe("9876543210")
    expect(fetchMock).toHaveBeenCalled()
  })
})
