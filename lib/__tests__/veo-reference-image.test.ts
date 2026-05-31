import { describe, expect, it } from "vitest"

import { buildVideoPromptWithReferences } from "@/lib/veo-reference-image"

describe("veo-reference-image", () => {
  it("enriches prompt when reference photos are provided", () => {
    const prompt = buildVideoPromptWithReferences("Laptop X", "Luxury cinematic", {
      imageUrls: ["https://cdn.example/a.jpg"],
      videoUrls: [],
    })
    expect(prompt).toContain("Laptop X")
    expect(prompt).toContain("reference photos")
  })

  it("mentions reference video when provided", () => {
    const prompt = buildVideoPromptWithReferences("Laptop X", "UGC style", {
      imageUrls: [],
      videoUrls: ["https://cdn.example/ref.mp4"],
    })
    expect(prompt).toContain("reference video")
  })
})
