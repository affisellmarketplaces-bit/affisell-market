import { describe, expect, it } from "vitest"

import {
  isGalleryPlayableVideoUrl,
  isPlayableDirectVideoUrl,
  resolveGalleryListingVideoUrl,
  resolveProductVideoEmbed,
} from "@/lib/product-playable-video"

describe("product-playable-video", () => {
  it("accepts Affisell blob and common video extensions", () => {
    expect(
      isPlayableDirectVideoUrl(
        "https://abc.public.blob.vercel-storage.com/videos/job-1.mp4"
      )
    ).toBe(true)
    expect(isPlayableDirectVideoUrl("https://cdn.example/promo.webm")).toBe(true)
  })

  it("accepts YouTube/Vimeo in gallery mode", () => {
    expect(isGalleryPlayableVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
    expect(isGalleryPlayableVideoUrl("https://vimeo.com/123456789")).toBe(true)
    expect(isGalleryPlayableVideoUrl("https://example.com/not-a-video")).toBe(false)
  })

  it("resolves embed kinds", () => {
    const yt = resolveProductVideoEmbed("https://youtu.be/dQw4w9WgXcQ")
    expect(yt?.kind).toBe("youtube")
    expect(yt?.src).toContain("youtube-nocookie.com/embed/")

    const direct = resolveProductVideoEmbed("https://cdn.example/clip.mp4")
    expect(direct).toEqual({ kind: "direct", src: "https://cdn.example/clip.mp4" })
  })

  it("prefers gallery videoAdUrl then ProductVideo row", () => {
    expect(
      resolveGalleryListingVideoUrl({
        videoAdUrl: "https://cdn.example/gallery.mp4",
        productVideoUrl: "https://cdn.example/generated.mp4",
      })
    ).toBe("https://cdn.example/gallery.mp4")

    expect(
      resolveGalleryListingVideoUrl({
        videoAdUrl: null,
        productVideoUrl: "https://abc.public.blob.vercel-storage.com/videos/x.mp4",
      })
    ).toBe("https://abc.public.blob.vercel-storage.com/videos/x.mp4")
  })
})
