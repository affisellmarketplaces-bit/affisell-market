import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lightning add — idempotent, auto-publishes when KYC allows. */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""

  const result = await quickAddAffiliateListing({
    affiliateId: session.user.id,
    productId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.published) {
    await revalidateAffiliateShopfront(session.user.id)
  }

  return NextResponse.json(
    {
      ...result.listing,
      created: result.created,
      published: result.published,
      publishBlocked: result.publishBlocked ?? null,
    },
    { status: result.created ? 201 : 200 }
  )
}
