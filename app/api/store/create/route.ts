import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = (await req.json()) as { storeName?: string; productId?: string }
  const storeName = body.storeName?.trim()
  if (!storeName) {
    return NextResponse.json({ success: false, error: "storeName required" }, { status: 400 })
  }
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) {
    return NextResponse.json({ success: false, error: "invalid storeName" }, { status: 400 })
  }
  const listingId = body.productId?.trim() || null
  const url = listingId
    ? `/boutique/${slug}?productId=${encodeURIComponent(listingId)}`
    : `/boutique/${slug}`
  return NextResponse.json({ success: true, url, slug, productId: listingId })
}
