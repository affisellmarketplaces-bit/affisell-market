import { describe, expect, it, vi, afterEach } from "vitest"

import { resolveVisionImageForOpenAI } from "@/lib/ai/vision-image-url"

describe("vision-image-url", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns inline data URL unchanged", async () => {
    const data = "data:image/jpeg;base64,abc123"
    const result = await resolveVisionImageForOpenAI({ imageDataUrl: data })
    expect(result).toEqual({ visionUrl: data, source: "inline_data" })
  })

  it("fetches https CDN and converts to inline base64", async () => {
    const bytes = Buffer.from("fake-image")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => bytes.buffer,
      })
    )

    const result = await resolveVisionImageForOpenAI({
      imageUrl: "https://cdn.example.com/jbl.jpg",
    })

    expect(result.source).toBe("cdn_fetched")
    expect(result.visionUrl.startsWith("data:image/jpeg;base64,")).toBe(true)
  })

  it("falls back to raw URL when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => null },
      })
    )

    const url = "https://cdn.example.com/private.jpg"
    const result = await resolveVisionImageForOpenAI({ imageUrl: url })
    expect(result).toEqual({ visionUrl: url, source: "cdn_url" })
  })

  it("throws when no image provided", async () => {
    await expect(resolveVisionImageForOpenAI({})).rejects.toThrow("image_required")
  })
})
