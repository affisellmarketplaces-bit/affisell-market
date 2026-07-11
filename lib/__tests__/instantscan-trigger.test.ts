import { describe, expect, it, vi } from "vitest"

import {
  isInstantScanHttpsUrl,
  isInstantScanPendingCdnUrl,
  resolveInstantScanTrigger,
} from "@/lib/instantscan/trigger"

describe("instantscan trigger", () => {
  const base = {
    mode: "guided" as const,
    guidedStep: 1,
    primaryImageUrl: "https://cdn.example.com/jbl.jpg",
    analyzeState: "idle" as const,
    attemptedUrl: null,
    mounted: true,
    analyzed: false,
  }

  it("analyzes when CDN url ready on step 1", () => {
    expect(resolveInstantScanTrigger(base)).toEqual({
      action: "analyze",
      url: "https://cdn.example.com/jbl.jpg",
    })
  })

  it("auto-advances from step 0 when image CDN ready", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        guidedStep: 0,
      })
    ).toEqual({ action: "advance_step" })
  })

  it("waits when blob url pending CDN", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        primaryImageUrl: "blob:http://localhost/x",
      })
    ).toEqual({ action: "wait_cdn" })
  })

  it("skips when image not https CDN url", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        primaryImageUrl: "http://insecure.example.com/x.jpg",
      })
    ).toEqual({ action: "skip", reason: "image_not_cdn_ready" })
  })

  it("skips when not mounted", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        mounted: false,
      })
    ).toEqual({ action: "skip", reason: "router_not_mounted" })
  })

  it("skips duplicate attempt while loading", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        analyzeState: "loading",
        attemptedUrl: base.primaryImageUrl,
      })
    ).toEqual({ action: "skip", reason: "already_loading" })
  })

  it("skips when already analyzed", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        analyzed: true,
        analyzeState: "done",
      })
    ).toEqual({ action: "skip", reason: "already_attempted" })
  })

  it("isInstantScanHttpsUrl accepts https CDN urls only", () => {
    expect(isInstantScanHttpsUrl("https://blob.vercel-storage.com/x.jpg")).toBe(true)
    expect(isInstantScanHttpsUrl("http://example.com/x.jpg")).toBe(false)
    expect(isInstantScanPendingCdnUrl("blob:abc")).toBe(true)
    expect(isInstantScanPendingCdnUrl(undefined)).toBe(true)
  })
})

describe("instantscan fetch trigger integration", () => {
  it("expect fetch /api/ai/analyze-product on analyze action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ title: "JBL Tune Flex", confidence: 0.97, latencyMs: 823 }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const decision = resolveInstantScanTrigger({
      mode: "guided",
      guidedStep: 1,
      primaryImageUrl: "https://cdn.example.com/jbl.jpg",
      analyzeState: "idle",
      attemptedUrl: null,
      mounted: true,
      analyzed: false,
    })

    expect(decision.action).toBe("analyze")
    if (decision.action !== "analyze") return

    await fetch("/api/ai/analyze-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: decision.url }),
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/analyze-product",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ imageUrl: "https://cdn.example.com/jbl.jpg" }),
      })
    )

    vi.unstubAllGlobals()
  })
})
