import { describe, expect, it } from "vitest"

import { pickGalleryIllustrations } from "@/lib/supplier-generate-description"

describe("supplier-generate-description", () => {
  it("picks gallery images by index", () => {
    const dataUrls = ["data:image/jpeg;base64,aaa", "data:image/jpeg;base64,bbb"]
    const urls = ["https://cdn.example/a.jpg"]
    const out = pickGalleryIllustrations(urls, dataUrls, [0, 2])
    expect(out).toEqual(["data:image/jpeg;base64,aaa", "https://cdn.example/a.jpg"])
  })
})
