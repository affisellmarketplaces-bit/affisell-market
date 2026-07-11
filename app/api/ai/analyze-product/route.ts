import { NextResponse } from "next/server"

import { analyzeProductFromImage } from "@/lib/ai/product-analyzer"
import {
  fingerprintImageInput,
  getCachedProductAnalysis,
  productAnalysisCacheKey,
  setCachedProductAnalysis,
} from "@/lib/ai/product-analysis-cache"
import { guardSupplierAiRoute } from "@/lib/ai-route-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const gate = await guardSupplierAiRoute(req, "ai-analyze-product")
  if (!gate.ok) return gate.response

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
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const analyzed = await analyzeProductFromImage({ imageUrl, imageDataUrl })
    const result = { ...analyzed, cached: false }
    await setCachedProductAnalysis(cacheKey, result)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "analyze_failed"
    console.log("[ai/analyze-product]", { result: "error", message })
    if (message === "ai_unavailable") {
      return NextResponse.json({ error: "ai_unavailable", fallback: "manual" }, { status: 503 })
    }
    if (message === "low_confidence") {
      return NextResponse.json({ error: "low_confidence", fallback: "manual" }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
