import { describe, expect, it } from "vitest"

import {
  isLikelyMobileUserAgent,
  orderSocialShareChannels,
  recommendShareChannel,
} from "@/lib/storefront-share-channel-recommendation"

describe("storefront-share-channel-recommendation", () => {
  it("recommends embed when widget is off", () => {
    expect(
      recommendShareChannel({
        embedEnabled: false,
        nativeShareAvailable: true,
        isMobile: true,
        locale: "fr",
      })
    ).toBe("embed")
  })

  it("prefers native share on mobile when embed is on", () => {
    expect(
      recommendShareChannel({
        embedEnabled: true,
        nativeShareAvailable: true,
        isMobile: true,
        locale: "en",
      })
    ).toBe("native")
  })

  it("prefers WhatsApp on mobile without native share", () => {
    expect(
      recommendShareChannel({
        embedEnabled: true,
        nativeShareAvailable: false,
        isMobile: true,
        locale: "en",
      })
    ).toBe("whatsapp")
  })

  it("prefers WhatsApp on French desktop and X otherwise", () => {
    expect(
      recommendShareChannel({
        embedEnabled: true,
        nativeShareAvailable: false,
        isMobile: false,
        locale: "fr-FR",
      })
    ).toBe("whatsapp")

    expect(
      recommendShareChannel({
        embedEnabled: true,
        nativeShareAvailable: false,
        isMobile: false,
        locale: "en",
      })
    ).toBe("twitter")
  })

  it("orders social channels with recommended first", () => {
    expect(orderSocialShareChannels("whatsapp")).toEqual(["whatsapp", "twitter"])
    expect(orderSocialShareChannels("twitter")).toEqual(["twitter", "whatsapp"])
    expect(orderSocialShareChannels("native")).toEqual(["whatsapp", "twitter"])
  })

  it("detects mobile user agents", () => {
    expect(isLikelyMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true)
    expect(isLikelyMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false)
  })
})
