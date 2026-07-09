import { describe, expect, it, vi } from "vitest"

import {
  countInlineImageUrls,
  migrateImageUrlArray,
  parseInlineDataUrlToBuffer,
  scanListingInlineImages,
  scanProductInlineImages,
} from "@/lib/product-image-cdn-migrate"

describe("product-image-cdn-migrate", () => {
  it("parses inline JPEG data URLs", () => {
    const buf = Buffer.from("hello")
    const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`
    expect(parseInlineDataUrlToBuffer(dataUrl).equals(buf)).toBe(true)
  })

  it("scans products with inline images", () => {
    const rows = scanProductInlineImages([
      {
        id: "p1",
        name: "OK",
        supplierId: "s1",
        images: ["https://cdn.example/a.jpg"],
      },
      {
        id: "p2",
        name: "KO",
        supplierId: "s1",
        images: ["data:image/jpeg;base64,abc", "https://cdn.example/b.jpg"],
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.productId).toBe("p2")
    expect(rows[0]?.inlineCount).toBe(1)
  })

  it("scans listings with inline custom images", () => {
    const rows = scanListingInlineImages([
      { id: "l1", productId: "p1", customImages: [] },
      { id: "l2", productId: "p2", customImages: ["data:image/png;base64,xyz"] },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.listingId).toBe("l2")
  })

  it("migrateImageUrlArray uploads only inline entries", async () => {
    const migrate = vi.fn(async () => "https://cdn.example/migrated.jpg")
    const out = await migrateImageUrlArray(
      ["https://cdn.example/keep.jpg", "data:image/jpeg;base64,abc"],
      { userId: "supplier-1", productId: "p1" },
      migrate
    )
    expect(out).toEqual(["https://cdn.example/keep.jpg", "https://cdn.example/migrated.jpg"])
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(countInlineImageUrls(out)).toBe(0)
  })
})
