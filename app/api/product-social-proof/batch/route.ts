import { NextResponse } from "next/server"

import type { ProductSocialProofData } from "@/lib/product-social-proof-shared"
import { toProductSocialProofApiResponse, formatLastSaleAgoLine } from "@/lib/product-social-proof-shared"
import { loadProductCrossSocialProofBatch } from "@/lib/product-social-proof-batch.server"
import { resolveProductSocialProofApiLocale } from "@/lib/product-social-proof-api-locale"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BatchApiItem = ReturnType<typeof toProductSocialProofApiResponse>

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { productIds?: unknown }
  const raw = Array.isArray(body.productIds) ? body.productIds : []
  const productIds = raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0)

  if (productIds.length === 0) {
    return NextResponse.json({ error: "Missing productIds" }, { status: 400 })
  }

  const url = new URL(request.url)
  const locale = resolveProductSocialProofApiLocale(request, url.searchParams.get("locale"))

  try {
    const map = await loadProductCrossSocialProofBatch(productIds)
    const items: Record<string, BatchApiItem> = {}
    for (const [id, data] of Object.entries(map) as [string, ProductSocialProofData][]) {
      items[id] = toProductSocialProofApiResponse(data, formatLastSaleAgoLine(data, locale))
    }
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Batch social proof failed"
    console.log("[product-social-proof]", { result: "batch_error", error: message })
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
