import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { publishMarketplaceImport } from "@/lib/marketplace/import-from-url.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST { productId?, listingId? } — publish a marketplace import draft. */
export async function POST(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await req.json().catch(() => ({}))) as {
    productId?: string
    listingId?: string
  }

  const result = await publishMarketplaceImport({
    productId: body.productId,
    listingId: body.listingId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
