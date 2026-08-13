import { NextResponse } from "next/server"

import { loadResellerStorefrontProduct } from "@/lib/boutique/load-reseller-storefront.server"
import { buildResellerBoutiquePath, slugFromResellerStoreName } from "@/lib/boutique/reseller-store-slug"

export async function POST(req: Request) {
  let body: { storeName?: string; productId?: string; slug?: string }
  try {
    body = (await req.json()) as { storeName?: string; productId?: string; slug?: string }
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 })
  }

  const listingId = body.productId?.trim() || null
  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    slugFromResellerStoreName(body.storeName ?? "")

  if (!slug) {
    return NextResponse.json({ success: false, error: "invalid_storeName" }, { status: 400 })
  }

  let listingValid: boolean | null = null
  if (listingId) {
    const product = await loadResellerStorefrontProduct(listingId)
    listingValid = product != null
  }

  const url = buildResellerBoutiquePath(slug, listingId)

  console.log("[store-create]", { slug, listingId, listingValid, result: "ok" })

  return NextResponse.json({
    success: true,
    url,
    slug,
    productId: listingId,
    listingValid,
  })
}
