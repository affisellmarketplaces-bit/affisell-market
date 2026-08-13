import { afterEach, describe, expect, it, vi } from "vitest"

import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"

describe("postBrandAiJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("handles empty response body without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", { status: 500, headers: { "content-type": "application/json" } })
      )
    )

    const result = await postBrandAiJson<{ bannerUrl?: string }>(
      "/api/store/generate-brand-banner",
      {},
      "Banner failed"
    )

    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain("Banner failed")
  })

  it("parses valid JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ bannerUrl: "/uploads/test.svg" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )

    const result = await postBrandAiJson<{ bannerUrl?: string }>(
      "/api/store/generate-brand-banner",
      {},
      "Banner failed"
    )

    expect(result.ok).toBe(true)
    expect(result.data?.bannerUrl).toBe("/uploads/test.svg")
  })
})
