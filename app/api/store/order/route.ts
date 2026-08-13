import { NextResponse } from "next/server"

import { createResellerOrder } from "@/lib/boutique/create-reseller-order.server"

export async function POST(req: Request) {
  let body: { storeSlug?: string; productId?: string; customerEmail?: string }
  try {
    body = (await req.json()) as { storeSlug?: string; productId?: string; customerEmail?: string }
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 })
  }

  const storeSlug = body.storeSlug?.trim()
  const productId = body.productId?.trim()
  if (!storeSlug || !productId) {
    return NextResponse.json({ success: false, error: "missing_fields" }, { status: 400 })
  }

  const result = await createResellerOrder({
    storeSlug,
    productId,
    customerEmail: body.customerEmail,
  })

  if (!result.success) {
    const status =
      result.error === "listing_not_found" ? 404 : result.error === "out_of_stock" ? 409 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
