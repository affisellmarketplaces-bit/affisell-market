import { describe, expect, it } from "vitest"

import { isLikelyImageFile, snapshotGalleryFilesFromInput } from "@/lib/product-image-upload"

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

describe("snapshotGalleryFilesFromInput", () => {
  it("clones file bytes into new File objects", async () => {
    const original = new File([new Uint8Array([9, 8, 7])], "Capture d’écran.png", { type: "image/png" })
    const list = {
      0: original,
      length: 1,
      item: (i: number) => (i === 0 ? original : null),
      [Symbol.iterator]: function* () {
        yield original
      },
    } as FileList

    const snap = await snapshotGalleryFilesFromInput(list)
    expect(snap).toHaveLength(1)
    expect(snap[0]!.name).toBe("Capture d’écran.png")
    expect(snap[0]).not.toBe(original)
    const bytes = new Uint8Array(await snap[0]!.arrayBuffer())
    expect(bytes).toEqual(new Uint8Array([9, 8, 7]))
  })
})
