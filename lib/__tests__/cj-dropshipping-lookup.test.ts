import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { extractCjProductId } from "@/lib/cj-dropshipping-lookup"

describe("extractCjProductId", () => {
  it("extracts the numeric pid from a real CJ product URL", () => {
    const url =
      "https://cjdropshipping.com/product/fashion-stand-collar-plush-jacket-p-2409100201381607200.html"
    expect(extractCjProductId(url)).toBe("2409100201381607200")
  })

  it("returns null for a non-product URL", () => {
    expect(extractCjProductId("https://cjdropshipping.com/")).toBeNull()
    expect(extractCjProductId("not a url")).toBeNull()
  })
})

describe("getCjProduct", () => {
  const AUTH_RESPONSE = {
    result: true,
    data: { accessToken: "tok-123", accessTokenExpiryDate: "2099-01-01 00:00:00" },
  }
  const PRODUCT_RESPONSE = {
    result: true,
    data: {
      pid: "2409100201381607200",
      productNameEn: "Fashion Plush Jacket",
      bigImage: "https://cf.cjdropshipping.com/main.jpg",
      productImageSet: ["https://cf.cjdropshipping.com/extra1.jpg"],
      sellPrice: "25.5",
      description: "Warm winter jacket",
      categoryName: "Women's Clothing",
      variants: [
        { vid: "v1", variantSku: "SKU-BLK-M", variantNameEn: "Black / M", variantSellPrice: "26.9" },
      ],
    },
  }

  function stubFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("authentication/getAccessToken")) {
          return { ok: true, json: async () => AUTH_RESPONSE }
        }
        if (url.includes("/product/query")) {
          return { ok: true, json: async () => PRODUCT_RESPONSE }
        }
        throw new Error(`unexpected fetch: ${url}`)
      })
    )
  }

  beforeEach(() => {
    vi.resetModules()
    process.env.CJ_API_EMAIL = "ops@affisell.test"
    process.env.CJ_API_KEY = "cj-key-123"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.CJ_API_EMAIL
    delete process.env.CJ_API_KEY
  })

  it("fetches, authenticates, and normalizes a real product URL", async () => {
    stubFetch()
    const { getCjProduct } = await import("@/lib/cj-dropshipping-lookup")

    const result = await getCjProduct(
      "https://cjdropshipping.com/product/fashion-plush-jacket-p-2409100201381607200.html"
    )

    expect(result.name).toBe("Fashion Plush Jacket")
    expect(result.priceUsd).toBe(25.5)
    expect(result.images).toEqual([
      "https://cf.cjdropshipping.com/main.jpg",
      "https://cf.cjdropshipping.com/extra1.jpg",
    ])
    expect(result.variants).toEqual([
      { name: "Black / M", priceUsd: 26.9, sku: "SKU-BLK-M" },
    ])
  })

  it("fails clearly when credentials are missing", async () => {
    delete process.env.CJ_API_EMAIL
    delete process.env.CJ_API_KEY
    stubFetch()
    const { getCjProduct } = await import("@/lib/cj-dropshipping-lookup")

    await expect(
      getCjProduct("https://cjdropshipping.com/product/x-p-123.html")
    ).rejects.toThrow(/CJ_API_EMAIL/)
  })

  it("fails clearly on an invalid CJ URL without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { getCjProduct } = await import("@/lib/cj-dropshipping-lookup")

    await expect(getCjProduct("https://cjdropshipping.com/")).rejects.toThrow(/URL CJ/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("caches the access token across calls instead of re-authenticating every time", async () => {
    stubFetch()
    const { getCjProduct } = await import("@/lib/cj-dropshipping-lookup")
    const url = "https://cjdropshipping.com/product/x-p-2409100201381607200.html"

    await getCjProduct(url)
    await getCjProduct(url)

    const authCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([u]) => String(u).includes("authentication/getAccessToken"))
    expect(authCalls).toHaveLength(1)
  })

  it("throws when CJ reports a product API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("authentication/getAccessToken")) {
          return { ok: true, json: async () => AUTH_RESPONSE }
        }
        return { ok: false, status: 500, json: async () => ({ result: false, message: "cj_down" }) }
      })
    )
    const { getCjProduct } = await import("@/lib/cj-dropshipping-lookup")

    await expect(
      getCjProduct("https://cjdropshipping.com/product/x-p-2409100201381607200.html")
    ).rejects.toThrow(/cj_down/)
  })
})
