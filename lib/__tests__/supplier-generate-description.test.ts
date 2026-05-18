import { describe, expect, it } from "vitest"

import { GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { buildVisionImagePayload, pickGalleryIllustrations } from "@/lib/supplier-generate-description"

describe("supplier-generate-description", () => {
  it("caps vision images at Groq limit", () => {
    const ill = Array.from({ length: 4 }, (_, i) => `data:image/jpeg;base64,ill${i}`)
    const gal = Array.from({ length: 4 }, (_, i) => `data:image/jpeg;base64,gal${i}`)
    const { visionImages } = buildVisionImagePayload({
      illustrationUrls: ill,
      galleryDataUrls: gal,
      galleryUrls: [],
    })
    expect(visionImages.length).toBeLessThanOrEqual(GROQ_VISION_MAX_IMAGES)
    expect(visionImages.length).toBe(4)
  })

  it("picks gallery images by index", () => {
    const dataUrls = ["data:image/jpeg;base64,aaa", "data:image/jpeg;base64,bbb"]
    const urls = ["https://cdn.example/a.jpg"]
    const out = pickGalleryIllustrations(urls, dataUrls, [0, 2])
    expect(out).toEqual(["data:image/jpeg;base64,aaa", "https://cdn.example/a.jpg"])
  })
})
