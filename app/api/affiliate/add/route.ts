import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Legacy minimal add — publishes listing at default markup. Prefer POST /api/affiliate/products/add */
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
    sellingPriceCents?: number
  }

  const productId = body.productId?.trim()
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const sellingRaw = Number(body.sellingPriceCents)
  if (!Number.isFinite(sellingRaw)) {
    return NextResponse.json({ error: "Missing or invalid sellingPriceCents" }, { status: 400 })
  }
  const sellingPriceCents = Math.round(sellingRaw)

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })
  }

  if (sellingPriceCents < product.basePriceCents) {
    return NextResponse.json(
      {
        error: `Selling price must be at least base price (${product.basePriceCents}¢)`,
      },
      { status: 400 }
    )
  }

  const kycBlocked = await requireMerchantVerifiedForPublish(session.user.id)
  if (kycBlocked) return kycBlocked

  const maxPos = await prisma.affiliateProduct.aggregate({
    where: { affiliateId: session.user.id },
    _max: { position: true },
  })
  const maxP = maxPos._max.position
  const position = (maxP == null ? -1 : maxP) + 1

  const row = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: session.user.id,
        productId: product.id,
      },
    },
    create: {
      affiliateId: session.user.id,
      productId: product.id,
      sellingPriceCents,
      customImages: [],
      collections: [],
      isListed: true,
      isFeatured: false,
      position,
    },
    update: {
      sellingPriceCents,
      isListed: true,
    },
  })

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
  }).catch((e) => console.error("[affiliate-invite] listing hook failed", e))

  await revalidateAffiliateShopfront(session.user.id)

  return NextResponse.json(row, { status: 201 })
}
