import { NextResponse } from "next/server"

import { guardSupplierAiRoute } from "@/lib/ai-route-guards"
import { suggestGuidedProduct } from "@/lib/guided-product-suggest"
import { isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request) {
  const gate = await guardSupplierAiRoute(req, "guided-suggest")
  if (!gate.ok) return gate.response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  const imageUrl =
    typeof body.imageUrl === "string" && isDurableListingImageUrl(body.imageUrl.trim())
      ? body.imageUrl.trim()
      : undefined
  const imageDataUrl =
    typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image/")
      ? body.imageDataUrl.trim()
      : undefined

  if (!title && !imageUrl && !imageDataUrl) {
    return NextResponse.json({ error: "title_or_image_required" }, { status: 400 })
  }

  try {
    const suggestion = await suggestGuidedProduct({ title, imageUrl, imageDataUrl })
    return NextResponse.json(suggestion)
  } catch (err) {
    const message = err instanceof Error ? err.message : "suggest_failed"
    console.log("[guided-suggest]", { result: "error", userId: gate.userId, message })
    return NextResponse.json(
      {
        error: "ai_unavailable",
        detail: message.slice(0, 200),
        fallback: true,
      },
      { status: 502 }
    )
  }
}
