import { afterEach, describe, expect, it, vi } from "vitest"

import {
  parseShopeePrice,
  parseShopeeSearchItems,
  resolveShopeeCountry,
  searchShopee,
} from "@/lib/radar/connectors/shopee"
import { isConnectorLive, LIVE_CONNECTOR_IDS } from "@/lib/radar/connectors/registry"

vi.mock("@/lib/radar/crawler/http", () => ({
  radarFetch: vi.fn(),
}))

import { radarFetch } from "@/lib/radar/crawler/http"

describe("Shopee connector", () => {
  afterEach(() => {
    vi.mocked(radarFetch).mockReset()
  })

  it("is registered live", () => {
    expect(LIVE_CONNECTOR_IDS.has("shopee")).toBe(true)
    expect(isConnectorLive("shopee")).toBe(true)
  })

  it("defaults unknown country to MY", () => {
    expect(resolveShopeeCountry("US")).toBe("MY")
    expect(resolveShopeeCountry("sg")).toBe("SG")
  })

  it("parses Shopee ×100000 prices", () => {
    expect(parseShopeePrice(1_990_000)).toBe(19.9)
    expect(parseShopeePrice(12.5)).toBe(12.5)
  })

  it("parses search_items JSON", () => {
    const items = parseShopeeSearchItems(
      {
        data: {
          items: [
            {
              item_basic: {
                itemid: 111,
                shopid: 222,
                name: "Wireless Earbuds",
                price: 2_500_000,
                image: "abc123",
                currency: "MYR",
              },
            },
          ],
        },
      },
      "MY",
      20
    )
    expect(items).toHaveLength(1)
    expect(items[0].externalId).toBe("111")
    expect(items[0].shopId).toBe("222")
    expect(items[0].title).toBe("Wireless Earbuds")
    expect(items[0].price).toBe(25)
    expect(items[0].currency).toBe("MYR")
    expect(items[0].url).toContain("shopee.com.my")
    expect(items[0].imageUrl).toContain("abc123")
  })

  it("searchShopee returns [] on HTTP error (degraded)", async () => {
    vi.mocked(radarFetch).mockResolvedValue(
      new Response("blocked", { status: 403 }) as Response
    )
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(searchShopee("led strip", "MY")).resolves.toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("searchShopee maps products on success", async () => {
    vi.mocked(radarFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              itemid: 9,
              shopid: 1,
              name: "Phone Case",
              price: 500_000,
              image: "img",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ) as Response
    )
    const products = await searchShopee("case", "SG")
    expect(products).toHaveLength(1)
    expect(products[0].marketplaceId).toBe("shopee")
    expect(products[0].country).toBe("SG")
    expect(products[0].externalId).toBe("9")
    expect(products[0].price).toBe(5)
  })
})
