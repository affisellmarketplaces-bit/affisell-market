import { describe, expect, it, vi, afterEach } from "vitest"

import { publicUrlForR2Key, resetR2ClientCache } from "@/lib/r2"

describe("import-video-r2", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetR2ClientCache()
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_ENDPOINT
    delete process.env.R2_PUBLIC_URL
  })

  it("publicUrlForR2Key joins base and key", () => {
    process.env.R2_PUBLIC_URL = "https://pub.example.r2.dev/"
    expect(publicUrlForR2Key("imported/abc.mp4")).toBe("https://pub.example.r2.dev/imported/abc.mp4")
  })

  it("returns external URLs when R2 is not configured", async () => {
    const { mirrorImportedVideosToR2 } = await import("@/lib/import-video-r2")
    const urls = await mirrorImportedVideosToR2(["https://cdn.example.com/v.mp4"], 2)
    expect(urls).toEqual(["https://cdn.example.com/v.mp4"])
  })

  it("falls back to external URL when fetch fails", async () => {
    process.env.R2_ACCESS_KEY_ID = "k"
    process.env.R2_SECRET_ACCESS_KEY = "s"
    process.env.R2_ENDPOINT = "https://x.r2.cloudflarestorage.com"
    process.env.R2_PUBLIC_URL = "https://pub.r2.dev"
    resetR2ClientCache()

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))

    const { mirrorImportedVideosToR2 } = await import("@/lib/import-video-r2")
    const urls = await mirrorImportedVideosToR2(["https://cdn.example.com/bad.mp4"], 1)
    expect(urls).toEqual(["https://cdn.example.com/bad.mp4"])
  })
})
