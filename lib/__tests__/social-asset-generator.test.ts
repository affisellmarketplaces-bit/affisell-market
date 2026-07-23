import { rm } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it, afterAll } from "vitest"

import type { BubbleProductView } from "@/lib/social/bubble-product-types"
import { generateSocialAssets } from "@/lib/social/social-asset-generator"

const product: BubbleProductView = {
  id: "probe-gen-001",
  title: "Tableau de bord numérique 12.3 pour Porsche Cayenne",
  imageUrl: null,
  salePrice: 1190.7,
  compareAtPrice: null,
  costPrice: 798.99,
  marginEuro: 391.71,
  deliveryDays: 5,
  deliveryCountry: "FR",
  supplierTrustScore: 80,
  supplierName: "Test",
  listingId: null,
  bubbleUrl: "https://affisell.com/product/x/bubble",
}

describe("generateSocialAssets", () => {
  afterAll(async () => {
    await rm(path.join(process.cwd(), "public", "generated", "social", product.id), {
      recursive: true,
      force: true,
    }).catch(() => undefined)
  })

  it("renders the full 12-asset pack (Satori-safe templates)", async () => {
    const bundle = await generateSocialAssets(product, { persist: true, force: true, concurrency: 3 })
    expect(bundle.assets).toHaveLength(12)
    expect(bundle.okCount).toBe(12)
    expect(bundle.failedKeys).toEqual([])
    expect(bundle.captions.moneyHook).toContain("sans stock")
  }, 120_000)

  it("supports priority pack for fast first paint", async () => {
    const { SOCIAL_ASSET_PRIORITY_KEYS } = await import("@/lib/social/social-asset-generator")
    const bundle = await generateSocialAssets(product, {
      persist: true,
      keys: SOCIAL_ASSET_PRIORITY_KEYS,
      concurrency: 2,
    })
    expect(bundle.assets.length).toBe(SOCIAL_ASSET_PRIORITY_KEYS.length)
    expect(bundle.okCount).toBe(SOCIAL_ASSET_PRIORITY_KEYS.length)
  }, 60_000)
})
