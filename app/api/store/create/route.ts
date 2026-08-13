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
  return NextResponse.json({ success: true, url: `/boutique/${slug}`, slug, productId: body.productId ?? null })
}
