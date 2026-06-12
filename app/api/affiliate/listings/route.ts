import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  recordAffiliateSwipe,
  sellingPriceFromMarkup,
} from "@/lib/affiliate-swipe-feed.server"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_MARKUP = 0.3

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    productId?: string
    markupRate?: number
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const markupRate =
    typeof body.markupRate === "number" && Number.isFinite(body.markupRate) && body.markupRate >= 0
      ? body.markupRate
      : DEFAULT_MARKUP

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true, isDraft: false },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })
  }

  const kycBlocked = await requireMerchantVerifiedForPublish(session.user.id)
  if (kycBlocked) return kycBlocked

  const sellingPriceCents = sellingPriceFromMarkup(product.basePriceCents, markupRate)
  const marginCents = Math.max(0, sellingPriceCents - product.basePriceCents)
  const customImages = [...(product.images as string[])].filter(Boolean).slice(0, 20)

  const maxPos = await prisma.affiliateProduct.aggregate({
    where: { affiliateId: session.user.id },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? -1) + 1

  try {
    const row = await prisma.affiliateProduct.upsert({
      where: {
        affiliateId_productId: { affiliateId: session.user.id, productId },
      },
      create: {
        affiliateId: session.user.id,
        productId,
        sellingPriceCents,
        marginCents,
        customImages,
        isListed: true,
        position,
      },
      update: {
        sellingPriceCents,
        marginCents,
        isListed: true,
      },
    })

    await recordAffiliateSwipe(session.user.id, productId, "like")

    const { onAffiliateListingLiveFromSupplierInvite } = await import(
      "@/lib/supplier-affiliate-invitation"
    )
    void onAffiliateListingLiveFromSupplierInvite({
      affiliateId: session.user.id,
      listingId: row.id,
      productId: product.id,
      productName: product.name,
      commissionRate: Number(product.commissionRate) || 0,
      variants: product.variants,
      basePriceCents: product.basePriceCents,
      images: product.images as string[],
    }).catch((e) => console.error("[affiliate-invite] swipe listing hook failed", e))

    return NextResponse.json(
      {
        ...row,
        markupRate,
        sellingPriceCents,
        marginCents,
      },
      { status: 201 }
    )
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "Listing conflict" }, { status: 409 })
    }
    throw e
  }
}
