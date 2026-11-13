import { NextResponse } from "next/server"

import { analyzeProductFromImage } from "@/lib/ai/product-analyzer"
import {
  fingerprintImageInput,
  getCachedProductAnalysis,
  productAnalysisCacheKey,
  setCachedProductAnalysis,
} from "@/lib/ai/product-analysis-cache"
import { guardSupplierAiSession, INSTANTSCAN_LIVE_LIMIT } from "@/lib/ai-route-guards"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { isInstantScanServerEnabled } from "@/lib/instantscan/flags"
import { logInstantScan } from "@/lib/instantscan/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Soft fallback body when NO model produced an answer (missing key, provider error, empty extraction).
 * It must not look like an analysis: no `confidence` (it used to claim 0.5), no `instantScanStage` / `visionVersion`
 * (it used to claim "gpt4o" / "v2" although nothing ran) — `provenance.method === "none"` says so.
 */
const MISSING_KEY_FALLBACK = {
  title: "Produit détecté - Complétez manuellement",
  description: "",
  category: "Autre",
  categoryId: null as string | null,
  attributes: {} as Record<string, string>,
  suggestedPrice: null as number | null,
  needsReview: true,
  fallback: true as const,
  provenance: {
    method: "none" as const,
    modelUsed: null,
    fallbackUsed: false,
    confidenceSource: "none" as const,
    priceSource: "none" as const,
  },
}

export async function POST(req: Request) {
  const gate = await guardSupplierAiSession()
  if (!gate.ok) return gate.response

  const flagEnabled = isInstantScanServerEnabled()
  console.log("[InstantScan] Enabled by:", {
    ENABLE_INSTANTSCAN: process.env.ENABLE_INSTANTSCAN,
    ENABLE_AI_VISION_V2: process.env.ENABLE_AI_VISION_V2,
    decision: flagEnabled,
  })
  logInstantScan("Flag check", { enabled: flagEnabled })

  if (!flagEnabled) {
    return NextResponse.json({ error: "instantscan_disabled" }, { status: 501 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim() : ""
  const imageDataUrl = typeof o.imageDataUrl === "string" ? o.imageDataUrl.trim() : ""

  if (!imageUrl && !imageDataUrl) {
    return NextResponse.json({ error: "image_required" }, { status: 400 })
  }

  const fingerprint = fingerprintImageInput({ imageUrl, imageDataUrl })
  const cacheKey = productAnalysisCacheKey(fingerprint)
  const cached = await getCachedProductAnalysis(cacheKey)
  if (cached) {
    logInstantScan("Cache hit (no rate limit)", { cacheKey, userId: gate.userId })
    return NextResponse.json({ ...cached, cached: true })
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    logInstantScan("API soft-fallback — missing OpenAI key", {
      keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 7) ?? "missing",
    })
    console.error("INSTANTSCAN ERROR FULL:", { reason: "missing_api_key" })
    return NextResponse.json({
      ...MISSING_KEY_FALLBACK,
      cached: false,
      error: "missing_api_key",
    })
  }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, gate.userId), {
    ...INSTANTSCAN_LIVE_LIMIT,
    prefix: "ai-analyze-live",
  })
  if (limited) return limited

  logInstantScan("Analyzing image", {
    imageUrl: imageUrl.slice(0, 120),
    hasDataUrl: Boolean(imageDataUrl),
    keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 7),
    userId: gate.userId,
  })

  try {
    const analyzed = await analyzeProductFromImage({ imageUrl, imageDataUrl })
    const result = { ...analyzed, cached: false }
    await setCachedProductAnalysis(cacheKey, result)
    // Tokens / estimated cost / latency per model call are MEASURED in lib/ai/usage-log.ts (one `[ai-usage]` line each);
    // no cost figure is asserted here.
    logInstantScan("API success", {
      model: analyzed.detectedModel ?? analyzed.title?.slice(0, 80),
      latency_ms: analyzed.latencyMs,
      stage: analyzed.instantScanStage ?? analyzed.visionVersion,
      model_used: analyzed.provenance?.modelUsed ?? null,
      fallback_used: analyzed.provenance?.fallbackUsed ?? false,
      confidence: analyzed.confidence ?? null,
      confidence_source: analyzed.provenance?.confidenceSource ?? "none",
      needsReview: analyzed.needsReview ?? false,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "analyze_failed"
    const detail = err instanceof Error ? err.message : String(err)
    console.error("INSTANTSCAN ERROR FULL:", err)
    logInstantScan("API soft-fallback", { message, detail })

    // Soft fallback — never hard-block the wizard; supplier can edit & publish.
    if (
      message === "ai_unavailable" ||
      message === "image_not_https" ||
      message === "image_fetch_failed" ||
      message === "low_confidence" ||
      message === "analyze_failed"
    ) {
      return NextResponse.json({
        ...MISSING_KEY_FALLBACK,
        cached: false,
        error: message === "low_confidence" ? "low_confidence" : "ai_unavailable",
        detail,
        needsReview: true,
        fallback: true,
      })
    }
    if (message === "image_required") {
      return NextResponse.json({ error: "image_required", detail }, { status: 400 })
    }
    return NextResponse.json({
      ...MISSING_KEY_FALLBACK,
      cached: false,
      error: "ai_unavailable",
      detail,
      needsReview: true,
      fallback: true,
    })
  }
}
