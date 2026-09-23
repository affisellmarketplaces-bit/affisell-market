import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { extractBigBuyProductId } from "@/lib/bigbuy-lookup"

describe("extractBigBuyProductId", () => {
  it("extracts the numeric id from a real BigBuy product URL", () => {
    const url = "https://www.bigbuy.eu/en/shop/product/coffee-capsules-nestle-africas-10-pieces-10-units_1251178"
    expect(extractBigBuyProductId(url)).toBe("1251178")
  })

  it("handles a trailing slash or query string after the id", () => {
    expect(extractBigBuyProductId("https://www.bigbuy.eu/en/shop/product/x_123/")).toBe("123")
    expect(extractBigBuyProductId("https://www.bigbuy.eu/en/shop/product/x_123?ref=abc")).toBe("123")
  })

  it("returns null for a non-product URL", () => {
    expect(extractBigBuyProductId("https://www.bigbuy.eu/en/")).toBeNull()
    expect(extractBigBuyProductId("not a url")).toBeNull()
  })
})

describe("getBigBuyProduct", () => {
  const CORE_RESPONSE = { id: 1251178, sku: "S1251178", wholesalePrice: 8.98, retailPrice: 9.98 }
  const INFO_RESPONSE = {
    id: 1251178,
    sku: "S1251178",
    name: "Coffee Capsules Nestlé AFRICAS 10 Pieces (10 Units)",
    description: "<b>Great coffee</b> capsules",
    url: "coffee-capsules-nestle-africas-10-pieces-10-units_1251178",
  }
  const IMAGES_RESPONSE = {
    id: 1251178,
    images: [{ id: 1, isCover: true, url: "https://cdnbigbuy.com/images/main.jpg" }],
  }

  function stubFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/rest/catalog/product/")) return { ok: true, json: async () => CORE_RESPONSE }
        if (url.includes("/rest/catalog/productinformation/")) return { ok: true, json: async () => INFO_RESPONSE }
        if (url.includes("/rest/catalog/productimages/")) return { ok: true, json: async () => IMAGES_RESPONSE }
        throw new Error(`unexpected fetch: ${url}`)
      })
    )
  }

  beforeEach(() => {
    vi.resetModules()
    process.env.BIGBUY_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.BIGBUY_API_KEY
  })

  it("fetches and assembles product core + text + images into one normalized result", async () => {
    stubFetch()
    const { getBigBuyProduct } = await import("@/lib/bigbuy-lookup")

    const result = await getBigBuyProduct(
      "https://www.bigbuy.eu/en/shop/product/coffee-capsules-nestle-africas-10-pieces-10-units_1251178"
    )

    expect(result.name).toBe("Coffee Capsules Nestlé AFRICAS 10 Pieces (10 Units)")
    expect(result.priceEur).toBe(8.98)
    expect(result.images).toEqual(["https://cdnbigbuy.com/images/main.jpg"])
    expect(result.sku).toBe("S1251178")
    expect(result.description).toBe("Great coffee capsules")
  })

  it("sends the Bearer token on every call", async () => {
    stubFetch()
    const { getBigBuyProduct } = await import("@/lib/bigbuy-lookup")

    await getBigBuyProduct("https://www.bigbuy.eu/en/shop/product/x_1251178")

    for (const call of vi.mocked(fetch).mock.calls) {
      const init = call[1] as RequestInit
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key")
    }
  })

  it("fails clearly when the API key is missing, without calling fetch", async () => {
    delete process.env.BIGBUY_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { getBigBuyProduct } = await import("@/lib/bigbuy-lookup")

    await expect(
      getBigBuyProduct("https://www.bigbuy.eu/en/shop/product/x_1251178")
    ).rejects.toThrow(/BIGBUY_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fails clearly on an invalid BigBuy URL without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { getBigBuyProduct } = await import("@/lib/bigbuy-lookup")

    await expect(getBigBuyProduct("https://www.bigbuy.eu/en/")).rejects.toThrow(/URL BigBuy/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws when BigBuy returns a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Invalid token" })
    )
    const { getBigBuyProduct } = await import("@/lib/bigbuy-lookup")

    await expect(
      getBigBuyProduct("https://www.bigbuy.eu/en/shop/product/x_1251178")
    ).rejects.toThrow(/401/)
  })
})
