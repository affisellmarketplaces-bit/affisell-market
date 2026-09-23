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

const CORE_RESPONSE = { id: 1251178, sku: "S1251178", wholesalePrice: 8.98, retailPrice: 9.98 }
const INFO_RESPONSE = {
  id: 1251178,
  sku: "S1251178",
  name: "Coffee Capsules Nestlé AFRICAS 10 Pieces (10 Units)",
  description: "Great coffee",
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

describe("BigBuy import — routes through the official API, price already EUR", () => {
  beforeEach(() => {
    // lib/currency-conversion.ts caches its FX rate in a module-level variable — reset the
    // module registry so this test never picks up state left behind by another test file.
    vi.resetModules()
    findFirst.mockResolvedValue(null)
    process.env.BIGBUY_API_KEY = "test-key"
    stubFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.BIGBUY_API_KEY
  })

  it("routes a BigBuy product URL through the API (not ScrapingBee), no currency conversion applied", async () => {
    const { scrapeSupplierProductFromUrl } = await import("@/lib/supplier-import-url-handler")

    const result = await scrapeSupplierProductFromUrl({
      url: "https://www.bigbuy.eu/en/shop/product/coffee-capsules-nestle-africas-10-pieces-10-units_1251178",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.platform).toBe("bigbuy")
    expect(result.method).toBe("bigbuy-api")
    expect(result.product.price).toBe(8.98)
    expect(result.product.currency).toBe("EUR")
    expect(result.product.title).toBe("Coffee Capsules Nestlé AFRICAS 10 Pieces (10 Units)")
  })
})
