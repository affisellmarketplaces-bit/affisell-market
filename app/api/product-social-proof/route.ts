import { NextResponse } from "next/server"

import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import {
  formatLastSaleAgoLine,
  toProductSocialProofApiResponse,
} from "@/lib/product-social-proof-shared"
import { loadProductCrossSocialProofCached } from "@/lib/product-social-proof.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const productId = url.searchParams.get("productId")?.trim() ?? ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const localeParam = url.searchParams.get("locale")
  const accept = request.headers.get("accept-language")?.toLowerCase() ?? ""
  const locale = resolveBinaryCopyLocale(
    localeParam ?? (accept.includes("fr") ? "fr" : "en")
  )

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
