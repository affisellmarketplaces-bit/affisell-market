import { describe, expect, it } from "vitest"

import {
  buildStoreHeroVeoPrompt,
  normalizeHeroVideoUrl,
} from "@/lib/storefront-hero-video-shared"

describe("storefront-hero-video-shared", () => {
  it("normalizes https video urls only", () => {
    expect(normalizeHeroVideoUrl("https://blob.example/video.mp4")).toContain("https://")
    expect(normalizeHeroVideoUrl("http://insecure")).toBeUndefined()
    expect(normalizeHeroVideoUrl("")).toBeUndefined()
  })

  it("builds a storefront hero prompt with store context", () => {
    const prompt = buildStoreHeroVeoPrompt({
      storeName: "Glow Lab",
      description: "Clean beauty picks",
      primary: "#18181b",
      accent: "#8b5cf6",
    })
    expect(prompt).toContain("Glow Lab")
    expect(prompt).toContain("Clean beauty picks")
    expect(prompt).toContain("No text overlays")
  })
})
