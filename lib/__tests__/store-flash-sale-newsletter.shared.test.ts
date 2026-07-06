import { describe, expect, it } from "vitest"

import {
  buildFlashSaleCampaignKey,
  flashSaleShopUrlWithAnchor,
  resolveFlashSaleNewsletterCampaign,
} from "@/lib/store-flash-sale-newsletter.shared"
import type { HomepageSection } from "@/lib/storefront-sections-shared"

const futureEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

function flashSections(overrides?: Partial<HomepageSection["content"]>): HomepageSection[] {
  return [
    {
      type: "flash-sale",
      enabled: true,
      content: {
        endsAt: futureEndsAt,
        listingIds: ["ap_2", "ap_1"],
        title: "48h only",
        ...overrides,
      },
    },
  ]
}

describe("store-flash-sale-newsletter.shared", () => {
  it("builds stable campaign keys", () => {
    const key = buildFlashSaleCampaignKey({
      endsAt: futureEndsAt,
      listingIds: ["ap_2", "ap_1"],
    })
    expect(key).toContain(futureEndsAt)
    expect(key).toContain("ap_1,ap_2")
  })

  it("detects a new active flash sale campaign", () => {
    const resolved = resolveFlashSaleNewsletterCampaign({
      sections: flashSections(),
      previousCampaignKey: undefined,
    })
    expect(resolved?.config.title).toBe("48h only")
    expect(resolved?.campaignKey).toBeTruthy()
  })

  it("skips when campaign key unchanged", () => {
    const config = { endsAt: futureEndsAt, listingIds: ["ap_1"] }
    const key = buildFlashSaleCampaignKey(config)
    const resolved = resolveFlashSaleNewsletterCampaign({
      sections: [{ type: "flash-sale", enabled: true, content: config }],
      previousCampaignKey: key,
    })
    expect(resolved).toBeNull()
  })

  it("appends flash-sale anchor to shop url", () => {
    expect(flashSaleShopUrlWithAnchor("https://shop.example.com")).toBe(
      "https://shop.example.com#flash-sale"
    )
  })
})
