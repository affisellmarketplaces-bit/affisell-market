import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { prisma } from "@/lib/prisma"

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
}

export async function POST(request: Request) {
  const session = await requireAffiliateSession()
  let productId = ""
  let affiliateProductId: string | null = null
  try {
    const body = (await request.json()) as { productId?: string; affiliateProductId?: string }
    productId = body.productId?.trim() ?? ""
    affiliateProductId = body.affiliateProductId?.trim() ?? null
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!productId) {
    return NextResponse.json({ error: "product_id_required" }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const token = randomBytes(5).toString("hex")
  const link = await prisma.bubbleLink.create({
    data: {
      token,
      productId,
      affiliateProductId,
      createdById: session.user.id,
    },
    select: { token: true, clicks: true },
  })

  const shortUrl = `${appOrigin()}/b/${link.token}?utm_source=social&utm_medium=bubble&utm_campaign=reseller`

  console.log("[bubble-link]", { productId, token: link.token, userId: session.user.id })

  return NextResponse.json({
    token: link.token,
    shortUrl,
    bubbleUrl: `${appOrigin()}/product/${productId}/bubble?utm_source=tiktok&utm_medium=bubble`,
    clicks: link.clicks,
  })
}
