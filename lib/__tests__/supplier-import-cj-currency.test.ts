import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findFirst },
  },
}))

vi.mock("@/lib/import-video-r2", () => ({
  mirrorImportedVideosToR2: vi.fn(async (videos: string[]) => videos),
}))

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
    productImageSet: [],
    sellPrice: "100",
    description: "Warm winter jacket",
    categoryName: "Women's Clothing",
    variants: [{ vid: "v1", variantSku: "SKU-BLK-M", variantNameEn: "Black / M", variantSellPrice: "110" }],
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
      if (url.includes("frankfurter.dev")) {
        return { ok: true, json: async () => ({ rates: { EUR: 0.92 } }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  )
}

describe("CJ Dropshipping import — USD to EUR conversion", () => {
  beforeEach(() => {
    // lib/cj-dropshipping-lookup.ts and lib/currency-conversion.ts cache state (access token,
    // FX rate) in module-level variables — reset the module registry so this test never picks
    // up a stale in-flight promise or cached token left behind by another test file.
    vi.resetModules()
    findFirst.mockResolvedValue(null)
    process.env.CJ_API_EMAIL = "ops@affisell.test"
    process.env.CJ_API_KEY = "cj-key-123"
    stubFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.CJ_API_EMAIL
    delete process.env.CJ_API_KEY
  })

  it("routes a CJ product URL through the API (not ScrapingBee), and converts USD to EUR", async () => {
    const { scrapeSupplierProductFromUrl } = await import("@/lib/supplier-import-url-handler")

    const result = await scrapeSupplierProductFromUrl({
      url: "https://cjdropshipping.com/product/fashion-plush-jacket-p-2409100201381607200.html",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.platform).toBe("cj")
    expect(result.method).toBe("cj-api")
    // 100 USD * 0.92 = 92 EUR — was USD before conversion.
    expect(result.product.price).toBeCloseTo(92, 5)
    expect(result.product.currency).toBe("EUR")
    // 110 USD * 0.92 = 101.2 EUR
    expect(result.product.variants[0]?.price).toBeCloseTo(101.2, 5)
  })
})
