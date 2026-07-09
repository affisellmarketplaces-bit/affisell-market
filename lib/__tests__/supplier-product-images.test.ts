import { describe, expect, it } from "vitest"

import {
  durableSupplierProductImageUrls,
  isDurableSupplierProductImageUrl,
  parseSupplierProductImages,
  resolveSupplierProductImagesForSave,
  validateSupplierProductImagesForPublish,
} from "@/lib/supplier-product-images"

describe("supplier-product-images", () => {
  it("strips blob and data previews from durable URLs", () => {
    expect(
      durableSupplierProductImageUrls([
        "blob:http://localhost/abc",
        "data:image/jpeg;base64,abc",
        "https://cdn.example.com/a.jpg",
      ])
    ).toEqual(["https://cdn.example.com/a.jpg"])
  })

  it("isDurableSupplierProductImageUrl accepts https and root paths", () => {
    expect(isDurableSupplierProductImageUrl("https://cdn.example.com/a.jpg")).toBe(true)
    expect(isDurableSupplierProductImageUrl("/uploads/a.jpg")).toBe(true)
    expect(isDurableSupplierProductImageUrl("data:image/jpeg;base64,x")).toBe(false)
    expect(isDurableSupplierProductImageUrl("blob:http://localhost/x")).toBe(false)
  })

  it("preserves existing DB images when autosave sends blob-only payload", () => {
    const existing = ["https://cdn.example.com/saved.jpg"]
    const saved = resolveSupplierProductImagesForSave(
      { images: ["blob:http://localhost/preview"] },
      existing
    )
    expect(saved).toEqual(existing)
  })

  it("preserves existing DB images when autosave sends data-only payload", () => {
    const existing = ["https://cdn.example.com/saved.jpg"]
    const saved = resolveSupplierProductImagesForSave(
      { images: ["data:image/jpeg;base64,abc123"] },
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

  it("parseSupplierProductImages drops blobs and data URLs", () => {
    expect(
      parseSupplierProductImages({
        images: ["blob:x", "data:image/jpeg;base64,x", "https://a.test/img.jpg"],
      })
    ).toEqual(["https://a.test/img.jpg"])
  })

  it("validateSupplierProductImagesForPublish requires durable CDN URL", () => {
    expect(validateSupplierProductImagesForPublish([])).toBe("product_images_required")
    expect(validateSupplierProductImagesForPublish(["data:image/jpeg;base64,x"])).toBe(
      "product_images_required"
    )
    expect(validateSupplierProductImagesForPublish(["https://cdn.example.com/a.jpg"])).toBeNull()
  })
})
