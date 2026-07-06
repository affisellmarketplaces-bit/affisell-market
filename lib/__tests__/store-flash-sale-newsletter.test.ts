import { beforeEach, describe, expect, it, vi } from "vitest"

const futureEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

describe("runFlashSaleNewsletterBlast", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("emails subscribers and marks campaign key", async () => {
    const campaignKey = `${futureEndsAt}|ap_1`
    const subscriberUpdate = vi.fn().mockResolvedValue({})
    const storeUpdate = vi.fn().mockResolvedValue({})
    const send = vi.fn().mockResolvedValue({ ok: true })

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        storeNewsletterSubscriber: {
          findMany: vi.fn().mockResolvedValue([
            { id: "sub_1", email: "buyer@example.com", locale: "fr" },
          ]),
          update: subscriberUpdate,
        },
        affiliateProduct: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "ap_1",
              sellingPriceCents: 1990,
              product: { name: "Serum" },
            },
          ]),
        },
        store: {
          findUnique: vi.fn().mockResolvedValue({ storefrontTheme: { brandOps: {} } }),
          update: storeUpdate,
        },
      },
    }))
    vi.doMock("@/lib/emails/send-store-flash-sale-alert", () => ({
      sendStoreFlashSaleAlertEmail: send,
    }))
    vi.doMock("@/lib/store-public-url", () => ({
      storePublicUrl: () => "https://affisell.com/shops/marie",
    }))

    const { runFlashSaleNewsletterBlast } = await import("@/lib/store-flash-sale-newsletter")
    const result = await runFlashSaleNewsletterBlast({
      storeId: "store_1",
      storeName: "Marie Shop",
      slug: "marie",
      customDomain: null,
      domainVerified: false,
      previousTheme: { brandOps: {} },
      nextTheme: {
        homepageSections: [
          {
            type: "flash-sale",
            enabled: true,
            content: { endsAt: futureEndsAt, listingIds: ["ap_1"], title: "Flash" },
          },
        ],
      },
    })

    expect(result?.emailsSent).toBe(1)
    expect(send).toHaveBeenCalled()
    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { lastFlashSaleAlertKey: expect.stringContaining(futureEndsAt) },
    })
    expect(storeUpdate).toHaveBeenCalled()
    expect(campaignKey).toBeTruthy()
  })

  it("returns null when campaign already notified", async () => {
    const endsAt = futureEndsAt
    const listingIds = ["ap_1"]
    const key = `${endsAt}|${listingIds.join(",")}`

    vi.doMock("@/lib/prisma", () => ({
      prisma: {},
    }))

    const { runFlashSaleNewsletterBlast } = await import("@/lib/store-flash-sale-newsletter")
    const result = await runFlashSaleNewsletterBlast({
      storeId: "store_1",
      storeName: "Marie Shop",
      slug: "marie",
      customDomain: null,
      domainVerified: false,
      previousTheme: { brandOps: { flashSaleNewsletterCampaignKey: key } },
      nextTheme: {
        homepageSections: [
          { type: "flash-sale", enabled: true, content: { endsAt, listingIds } },
        ],
      },
    })

    expect(result).toBeNull()
  })
})
