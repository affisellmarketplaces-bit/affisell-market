import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("radar crawler degraded mode", () => {
  beforeEach(() => {
    vi.stubEnv("TIKTOK_CRAWLER_ACCESS_TOKEN", "")
    vi.stubEnv("SERPER_API_KEY", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("crawlBestSellers skips TikTok without token (no throw)", async () => {
    const { crawlBestSellers } = await import("@/lib/radar/crawler/category-crawler")
    const products = await crawlBestSellers("tiktok_shop", "fashion", "US")
    expect(products).toEqual([])
  })

  it("crawlKeyword skips TikTok search without token (no throw)", async () => {
    const { crawlKeyword } = await import("@/lib/radar/crawler/search-crawler")
    const products = await crawlKeyword("tiktok_shop", "shapewear", "US")
    expect(products).toEqual([])
  })
})
