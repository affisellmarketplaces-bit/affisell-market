import { describe, expect, it } from "vitest"

import {
  assessGallery,
  assessPhoto,
  hammingHex,
  originalResolutionCandidate,
  type PhotoMetrics,
} from "@/lib/photo-quality"

const m = (over: Partial<PhotoMetrics> = {}): PhotoMetrics => ({
  width: 1200,
  height: 1200,
  bytes: 240_000,
  format: "jpeg",
  cornerLuma: [245, 244, 246, 245],
  dHash: "f0f0f0f0f0f0f0f0",
  ...over,
})

describe("assessPhoto", () => {
  it("accepts a bright, large, well-compressed shot", () => {
    expect(assessPhoto(m(), { isMain: true })).toEqual([])
  })
  it("flags small, low-res and extreme-ratio photos", () => {
    expect(assessPhoto(m({ width: 500, height: 500 }))).toContain("too_small")
    expect(assessPhoto(m({ width: 800, height: 800 }))).toContain("low_res")
    expect(assessPhoto(m({ width: 3000, height: 900 }))).toContain("extreme_ratio")
  })
  it("flags over-compression on a big canvas", () => {
    expect(assessPhoto(m({ bytes: 9_000 }))).toContain("over_compressed")
  })
  it("judges the background of the MAIN photo only", () => {
    const dark = m({ cornerLuma: [30, 28, 35, 32] })
    expect(assessPhoto(dark, { isMain: true })).toContain("dark_background")
    expect(assessPhoto(dark, { isMain: false })).not.toContain("dark_background")
    const busy = m({ cornerLuma: [250, 120, 245, 90] })
    expect(assessPhoto(busy, { isMain: true })).toContain("busy_background")
  })
})

describe("assessGallery", () => {
  it("detects near-duplicates by perceptual hash and unreadable images", () => {
    const g = assessGallery([m(), m({ dHash: "f0f0f0f0f0f0f0f1" }), null, m({ dHash: "0f0f0f0f0f0f0f0f" })])
    expect(g.perImage[1]!.issues).toContain("duplicate")
    expect(g.perImage[2]!.issues).toEqual(["unreadable"])
    expect(g.perImage[3]!.issues).not.toContain("duplicate")
    expect(g.galleryIssues).toContain("duplicates")
  })
  it("wants at least 3 photos and notices mixed sizes", () => {
    expect(assessGallery([m(), m({ dHash: "aaaaaaaaaaaaaaaa" })]).galleryIssues).toContain("too_few")
    const mixed = assessGallery([m(), m({ dHash: "1111111111111111", width: 4000, height: 4000 }), m({ dHash: "2222222222222222" })])
    expect(mixed.galleryIssues).toContain("mixed_sizes")
  })
  it("scores a clean gallery 100 and a raw import far lower", () => {
    const clean = assessGallery([m(), m({ dHash: "1111111111111111" }), m({ dHash: "2222222222222222" }), m({ dHash: "3333333333333333" })])
    expect(clean.score).toBe(100)
    const raw = assessGallery([m({ width: 640, height: 640, cornerLuma: [20, 25, 30, 22] }), null])
    expect(raw.score).toBeLessThan(50)
  })
})

describe("helpers", () => {
  it("hamming distance", () => {
    expect(hammingHex("0000000000000000", "0000000000000000")).toBe(0)
    expect(hammingHex("ffffffffffffffff", "0000000000000000")).toBe(64)
    expect(hammingHex("f", "ff")).toBe(64)
  })
  it("derives the original-resolution candidate from a marketplace thumbnail URL", () => {
    expect(originalResolutionCandidate("https://ae01.alicdn.com/kf/S123abc.jpg_640x640.jpg")).toBe("https://ae01.alicdn.com/kf/S123abc.jpg")
    expect(originalResolutionCandidate("https://ae01.alicdn.com/kf/S123abc.jpg_Q90.jpg_.webp")).toBe("https://ae01.alicdn.com/kf/S123abc.jpg")
    expect(originalResolutionCandidate("https://cdn.example.com/a/photo.jpg")).toBeNull()
  })
})
