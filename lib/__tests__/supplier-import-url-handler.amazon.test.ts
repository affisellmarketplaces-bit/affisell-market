import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

const mockHtml = readFileSync(
  resolve(process.cwd(), "tests/__mocks__/amazon-product.html"),
  "utf8"
)

describe("scrapeSupplierProductFromUrl amazon direct fallback", () => {
  beforeEach(() => {
    findFirst.mockResolvedValue(null)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("extracts complete Amazon data without ScrapingBee", async () => {
    const { scrapeSupplierProductFromUrl } = await import("@/lib/supplier-import-url-handler")

    const result = await scrapeSupplierProductFromUrl({
      url: "https://www.amazon.fr/dp/B0TEST1234",
      options: { fast: true },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(findFirst).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      "https://www.amazon.fr/dp/B0TEST1234",
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result.method).toBe("direct")
    expect(result.warnings).toEqual([])
    expect(result.product.title).toContain("Anneau")
    expect(result.product.price).toBe(12.34)
    expect(result.product.images).toEqual([
      "https://m.media-amazon.com/images/I/51-main._AC_SL1500_.jpg",
      "https://m.media-amazon.com/images/I/41-alt._AC_SL1000_.jpg",
    ])
    expect(result.product.specs.Materiau).toBe("Acier inoxydable")
    expect(result.product.colors[0]?.name).toBe("Gold")
    expect(result.product.sizes[0]?.name).toBe("Ajustable")
    expect(result.product.sku).toBe("B0TEST1234")
    expect(result.product.is_duplicate).toBe(false)
  })
})
