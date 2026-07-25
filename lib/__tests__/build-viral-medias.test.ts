import { describe, expect, it } from "vitest"

import { buildViralMedias } from "@/lib/social/build-viral-medias"

describe("buildViralMedias", () => {
  it("dedupes images and slots direct mp4 after 2nd photo", () => {
    const medias = buildViralMedias({
      customImages: ["https://cdn.example/a.jpg"],
      images: [
        "https://cdn.example/a.jpg",
        "https://cdn.example/b.jpg",
        "https://cdn.example/c.jpg",
      ],
      videoUrl: "https://cdn.example/clip.mp4",
    })
    expect(medias.map((m) => m.type)).toEqual(["image", "image", "video", "image"])
    expect(medias[2]?.url).toContain("clip.mp4")
  })

  it("skips YouTube embeds (MediaRecorder needs a file URL)", () => {
    const medias = buildViralMedias({
      images: ["https://cdn.example/a.jpg"],
      videoAdUrl: "https://www.youtube.com/watch?v=abc",
    })
    expect(medias).toHaveLength(1)
    expect(medias[0]?.type).toBe("image")
  })
})
