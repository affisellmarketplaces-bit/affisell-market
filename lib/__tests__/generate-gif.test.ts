import { describe, expect, it } from "vitest"

import { pickGifMedias } from "@/lib/social/viral-canvas-shared"
import { sniffGifContainer } from "@/lib/social/video-container-sniff"

describe("viral gif helpers", () => {
  it("sniffs GIF87a / GIF89a", () => {
    const g89 = new TextEncoder().encode("GIF89a")
    const g87 = new TextEncoder().encode("GIF87a")
    expect(sniffGifContainer(g89)).toBe(true)
    expect(sniffGifContainer(g87)).toBe(true)
    expect(sniffGifContainer(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(false)
  })

  it("prefers images over video for GIF pack", () => {
    const medias = pickGifMedias([
      { type: "video", url: "https://cdn.example/a.mp4" },
      { type: "image", url: "https://cdn.example/a.jpg" },
      { type: "image", url: "https://cdn.example/b.jpg" },
    ])
    expect(medias.every((m) => m.type === "image")).toBe(true)
    expect(medias).toHaveLength(2)
  })
})
