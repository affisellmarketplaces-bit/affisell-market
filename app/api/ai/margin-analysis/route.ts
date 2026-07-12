import { NextResponse } from "next/server"
import { z } from "zod"

import { guardSupplierAiSession, SMART_MARGIN_LIMIT } from "@/lib/ai-route-guards"
import { runMarginAnalysis } from "@/lib/ai/smart-margin-service"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  productId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  catalogPriceEur: z.number().positive().optional(),
  userMargin: z.number().min(1).max(50),
})

export async function POST(req: Request) {
  const gate = await guardSupplierAiSession()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const { productId, categoryId, title, catalogPriceEur, userMargin } = parsed.data
  if (!productId && !categoryId && !title) {
    return NextResponse.json(
      { error: "product_ref_required", detail: "Provide productId, categoryId, or title" },
      { status: 400 }
    )
  }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, gate.userId), {
    ...SMART_MARGIN_LIMIT,
    prefix: "smart-margin",
  })
  if (limited) return limited

  try {
    const result = await runMarginAnalysis({
      userId: gate.userId,
      userMargin,
      productId,
      categoryId,
      title,
      catalogPriceEur,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[SmartMargin API] Error:", err)
    return NextResponse.json({ error: "analysis_failed" }, { status: 503 })
  }
}
