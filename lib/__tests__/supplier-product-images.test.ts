import { describe, expect, it } from "vitest"

import {
  durableSupplierProductImageUrls,
  parseSupplierProductImages,
  resolveSupplierProductImagesForSave,
} from "@/lib/supplier-product-images"

describe("supplier-product-images", () => {
  it("strips blob previews from durable URLs", () => {
    expect(
      durableSupplierProductImageUrls([
        "blob:http://localhost/abc",
        "https://cdn.example.com/a.jpg",
      ])
    ).toEqual(["https://cdn.example.com/a.jpg"])
  })

  it("preserves existing DB images when autosave sends blob-only payload", () => {
    const existing = ["https://cdn.example.com/saved.jpg"]
    const saved = resolveSupplierProductImagesForSave(
      { images: ["blob:http://localhost/preview"] },
      existing
    )
    expect(saved).toEqual(existing)
  })

  it("accepts fresh CDN URLs from upload", () => {
    const saved = resolveSupplierProductImagesForSave(
      { images: ["https://blob.vercel-storage.com/gallery-1.jpg"] },
      ["https://cdn.example.com/old.jpg"]
    )
    expect(saved).toEqual(["https://blob.vercel-storage.com/gallery-1.jpg"])
  })

  it("parseSupplierProductImages drops blobs", () => {
    expect(parseSupplierProductImages({ images: ["blob:x", "https://a.test/img.jpg"] })).toEqual([
      "https://a.test/img.jpg",
    ])
  })
})
