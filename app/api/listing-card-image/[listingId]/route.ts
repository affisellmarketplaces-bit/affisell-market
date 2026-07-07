import { NextResponse } from "next/server"

import { getListingCardImageWebp } from "@/lib/listing-card-image.server"
import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"

export const runtime = "nodejs"
export const revalidate = 86_400

type RouteContext = { params: Promise<{ listingId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { listingId } = await context.params
  const body = await getListingCardImageWebp(listingId)

  if (!body) {
    return NextResponse.redirect(new URL(PRODUCT_CARD_IMAGE_FALLBACK, _request.url), 302)
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  })
}
