import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { removeAffiliateListingsFromStorefront } from "@/lib/affiliate-listing-remove"
import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { affiliateListingsWhere } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"
import { findExclusiveProductsBlockedForAffiliate } from "@/lib/product-exclusivity-guard.server"
import { mayListOnProduct } from "@/lib/reseller-import/review"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"
import { withListingPresenceSource } from "@/lib/listing-presence/record.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown
    isFeatured?: boolean
    isListed?: boolean
    auctionEligible?: boolean
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200)
    : []

  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }

  if (
    typeof body.isFeatured !== "boolean" &&
    typeof body.isListed !== "boolean" &&
    typeof body.auctionEligible !== "boolean"
  ) {
    return NextResponse.json(
      { error: "isFeatured, isListed, or auctionEligible required" },
      { status: 400 }
    )
  }

  const where = { id: { in: ids }, ...affiliateListingsWhere(session.user.id) }

  if (typeof body.isFeatured === "boolean") {
    await prisma.affiliateProduct.updateMany({
      where,
      data: { isFeatured: body.isFeatured },
    })
  }

  /** Listings that could not go live because their product is held in exclusivity by another reseller. */
  let exclusiveBlockedIds: string[] = []
  /** Listings whose product is a reseller import not yet approved / publishable. */
  let notReviewedIds: string[] = []

  if (typeof body.isListed === "boolean") {
    let listedWhere = where
    if (body.isListed) {
      const candidates = await prisma.affiliateProduct.findMany({
        where,
        select: { id: true, productId: true, product: { select: { active: true, isDraft: true, tags: true } } },
      })
      // A reseller import not yet approved (or not publishable) is never listed by hand (same rule as the listing PATCH).
      notReviewedIds = candidates.filter((c) => !c.product || !mayListOnProduct(c.product)).map((c) => c.id)
      const blocked = await findExclusiveProductsBlockedForAffiliate(
        candidates.map((c) => c.productId),
        session.user.id
      )
      const blockedProducts = new Set(blocked.map((b) => b.productId))
      exclusiveBlockedIds = candidates.filter((c) => blockedProducts.has(c.productId)).map((c) => c.id)
      const refused = new Set([...exclusiveBlockedIds, ...notReviewedIds])
      if (refused.size > 0) {
        listedWhere = { ...where, id: { in: candidates.filter((c) => !refused.has(c.id)).map((c) => c.id) } }
      }
    }
    const nextListed = body.isListed
    await withListingPresenceSource(prisma, { source: "reseller_bulk", actorId: session.user.id }, (tx) =>
      tx.affiliateProduct.updateMany({
        where: listedWhere,
        data: { isListed: nextListed },
      }),
    )
    if (!body.isListed) {
      await cancelAuctionsForListings(ids)
      await prisma.affiliateProduct.updateMany({
        where,
        data: { auctionEligible: false },
      })
    }
  }

  if (typeof body.auctionEligible === "boolean") {
    if (body.auctionEligible) {
      await prisma.affiliateProduct.updateMany({
        where: { ...where, isListed: true },
        data: { auctionEligible: true },
      })
    } else {
      await prisma.affiliateProduct.updateMany({
        where,
        data: { auctionEligible: false },
      })
      await cancelAuctionsForListings(ids)
    }
  }

  await revalidateAffiliateShopfront(session.user.id)

  return NextResponse.json({
    ok: true,
    ...(exclusiveBlockedIds.length > 0 ? { exclusiveBlocked: exclusiveBlockedIds.length } : {}),
    ...(notReviewedIds.length > 0 ? { notReviewed: notReviewedIds.length } : {}),
  })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200)
    : []

  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }

  const result = await removeAffiliateListingsFromStorefront(session.user.id, ids)
  return NextResponse.json({ ok: true, ...result })
}
