import { NextResponse } from "next/server"

import {
  formatLastSaleAgoLine,
  toProductSocialProofApiResponse,
} from "@/lib/product-social-proof-shared"
import { resolveProductSocialProofApiLocale } from "@/lib/product-social-proof-api-locale"
import { loadProductCrossSocialProofCached } from "@/lib/product-social-proof.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const productId = url.searchParams.get("productId")?.trim() ?? ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const locale = resolveProductSocialProofApiLocale(request, url.searchParams.get("locale"))

  try {
    const data = await loadProductCrossSocialProofCached(productId)
    const lastSaleAgo = formatLastSaleAgoLine(data, locale)
    return NextResponse.json(toProductSocialProofApiResponse(data, lastSaleAgo), {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load social proof"
    console.log("[product-social-proof]", { productId, result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
