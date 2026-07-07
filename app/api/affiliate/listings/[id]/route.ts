import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"
import { revalidateListingCardImage } from "@/lib/revalidate-listing-card-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    /** @deprecated use isListed */
    active?: boolean
    isListed?: boolean
    auctionEligible?: boolean
    sellingPriceCents?: number
  }

  const row = await prisma.affiliateProduct.findUnique({
    where: { id },
    include: { product: true },
  })

  if (!row) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (row.affiliateId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const nextSelling =
    typeof body.sellingPriceCents === "number" && Number.isFinite(body.sellingPriceCents)
      ? Math.round(body.sellingPriceCents)
      : undefined

  if (nextSelling !== undefined && nextSelling < row.product.basePriceCents) {
    return NextResponse.json({ error: "Selling price cannot be below base price" }, { status: 400 })
  }

  const nextListed =
    typeof body.isListed === "boolean"
      ? body.isListed
      : typeof body.active === "boolean"
        ? body.active
        : row.isListed

  const nextAuctionEligible =
    typeof body.auctionEligible === "boolean" ? body.auctionEligible : row.auctionEligible

  if (nextAuctionEligible && !nextListed) {
    return NextResponse.json(
      { error: "List this product on your storefront before adding it to Auction Arena." },
      { status: 400 }
    )
  }

  if (nextListed && !row.isListed) {
    const kycBlocked = await requireMerchantVerifiedForPublish(session.user.id)
    if (kycBlocked) return kycBlocked
  }

  const updated = await prisma.affiliateProduct.update({
    where: { id },
    data: {
      ...(typeof body.isListed === "boolean" ? { isListed: body.isListed } : {}),
      ...(typeof body.active === "boolean" ? { isListed: body.active } : {}),
      ...(typeof body.auctionEligible === "boolean" ? { auctionEligible: body.auctionEligible } : {}),
      ...(nextSelling !== undefined ? { sellingPriceCents: nextSelling } : {}),
      ...(!nextListed ? { auctionEligible: false } : {}),
    },
  })

  if (!nextListed || !nextAuctionEligible) {
    await cancelAuctionsForListings([id])
  }

  await revalidateAffiliateShopfront(session.user.id)
  revalidateListingCardImage(id)

  return NextResponse.json(updated)
}
