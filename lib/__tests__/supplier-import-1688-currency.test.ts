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

const ONEBOUND_ITEM = {
  item: {
    title: "Chaise de bureau ergonomique",
    desc: "Chaise pivotante avec accoudoirs réglables",
    price: "100",
    pic_url: "https://img.alicdn.com/main.jpg",
    item_imgs: [],
    min_num: 2,
    seller_info: { shop_name: "Guangzhou Furniture Co" },
    skus: { sku: [{ properties_name: "Noir", price: "105", quantity: "50" }] },
  },
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("onebound.cn")) {
        return { ok: true, json: async () => ONEBOUND_ITEM }
      }
      if (url.includes("frankfurter.dev")) {
        return { ok: true, json: async () => ({ rates: { EUR: 0.13 } }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  )
}

describe("1688 import — CNY to EUR conversion", () => {
  beforeEach(() => {
    // lib/currency-conversion.ts caches its FX rate in a module-level variable — reset the
    // module registry so this test never picks up state left behind by another test file.
    vi.resetModules()
    findFirst.mockResolvedValue(null)
    process.env.ONEBOUND_KEY = "test-key"
    process.env.ONEBOUND_SECRET = "test-secret"
    stubFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete process.env.ONEBOUND_KEY
    delete process.env.ONEBOUND_SECRET
  })

  it("converts the main price and every variant price from CNY to EUR, and labels the currency correctly", async () => {
    const { scrapeSupplierProductFromUrl } = await import("@/lib/supplier-import-url-handler")

    const result = await scrapeSupplierProductFromUrl({
      url: "https://detail.1688.com/offer/123456789.html",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 100 CNY * 0.13 = 13 EUR — was previously stored as "100" unconverted.
    expect(result.product.price).toBeCloseTo(13, 5)
    expect(result.product.original_price).toBeCloseTo(13, 5)
    expect(result.product.currency).toBe("EUR")
    // 105 CNY * 0.13 = 13.65 EUR
    expect(result.product.variants[0]?.price).toBeCloseTo(13.65, 5)
  })
})
