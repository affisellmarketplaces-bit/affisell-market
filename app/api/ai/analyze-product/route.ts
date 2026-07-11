import { NextResponse } from "next/server"

import { analyzeProductFromImage } from "@/lib/ai/product-analyzer"
import {
  fingerprintImageInput,
  getCachedProductAnalysis,
  productAnalysisCacheKey,
  setCachedProductAnalysis,
} from "@/lib/ai/product-analysis-cache"
import { guardSupplierAiRoute } from "@/lib/ai-route-guards"
import { isInstantScanServerEnabled } from "@/lib/instantscan/flags"
import { logInstantScan } from "@/lib/instantscan/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const gate = await guardSupplierAiRoute(req, "ai-analyze-product")
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

  if (!process.env.OPENAI_API_KEY?.trim()) {
    logInstantScan("API rejected — missing OpenAI key", {
      keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 7) ?? "missing",
    })
    return NextResponse.json({ error: "missing_api_key", fallback: "manual" }, { status: 503 })
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

  logInstantScan("Analyzing image", {
    imageUrl: imageUrl.slice(0, 120),
    hasDataUrl: Boolean(imageDataUrl),
    keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 7),
  })

  const fingerprint = fingerprintImageInput({ imageUrl, imageDataUrl })
  const cacheKey = productAnalysisCacheKey(fingerprint)
  const cached = await getCachedProductAnalysis(cacheKey)
  if (cached) {
    logInstantScan("Cache hit", { cacheKey })
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const analyzed = await analyzeProductFromImage({ imageUrl, imageDataUrl })
    const result = { ...analyzed, cached: false }
    await setCachedProductAnalysis(cacheKey, result)
    logInstantScan("API success", {
      model: analyzed.detectedModel ?? analyzed.title?.slice(0, 80),
      latency_ms: analyzed.latencyMs,
      stage: analyzed.instantScanStage ?? analyzed.visionVersion,
      cost_usd: 0.003,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "analyze_failed"
    console.error("[InstantScan API] Error:", err)
    logInstantScan("API error", { message })
    if (message === "ai_unavailable") {
      return NextResponse.json({ error: "ai_unavailable", fallback: "manual" }, { status: 503 })
    }
    if (message === "low_confidence") {
      return NextResponse.json({ error: "low_confidence", fallback: "manual" }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
