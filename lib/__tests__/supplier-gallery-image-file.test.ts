import { describe, expect, it } from "vitest"

import { isLikelyImageFile } from "@/lib/product-image-upload"

describe("isLikelyImageFile", () => {
  it("accepts image mime types", () => {
    const file = new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" })
    expect(isLikelyImageFile(file)).toBe(true)
  })

  it("accepts HEIC by extension when mime is empty", () => {
    const file = new File([new Uint8Array([1])], "IMG_1234.HEIC", { type: "" })
    expect(isLikelyImageFile(file)).toBe(true)
  })

  it("rejects non-image extensions", () => {
    const file = new File([new Uint8Array([1])], "readme.pdf", { type: "application/pdf" })
    expect(isLikelyImageFile(file)).toBe(false)
  })
})
