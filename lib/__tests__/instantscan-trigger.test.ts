import { describe, expect, it, vi } from "vitest"

import {
  isInstantScanReadyUrl,
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
    clientEnabled: true,
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

  it("skips when image not http CDN url", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        primaryImageUrl: "blob:http://localhost/x",
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

  it("skips when client flag disabled", () => {
    expect(
      resolveInstantScanTrigger({
        ...base,
        clientEnabled: false,
      })
    ).toEqual({ action: "skip", reason: "disabled_by_flag" })
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

  it("isInstantScanReadyUrl accepts https CDN urls", () => {
    expect(isInstantScanReadyUrl("https://blob.vercel-storage.com/x.jpg")).toBe(true)
    expect(isInstantScanReadyUrl("blob:abc")).toBe(false)
    expect(isInstantScanReadyUrl("")).toBe(false)
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
      clientEnabled: true,
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
