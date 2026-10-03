import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { removeAffiliateListingsFromStorefront } from "@/lib/affiliate-listing-remove"
import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { affiliateListingsWhere } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"
import { findExclusiveProductsBlockedForAffiliate } from "@/lib/product-exclusivity-guard.server"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

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

  if (typeof body.isListed === "boolean") {
    let listedWhere = where
    if (body.isListed) {
      const candidates = await prisma.affiliateProduct.findMany({ where, select: { id: true, productId: true } })
      const blocked = await findExclusiveProductsBlockedForAffiliate(
        candidates.map((c) => c.productId),
        session.user.id
      )
      const blockedProducts = new Set(blocked.map((b) => b.productId))
      exclusiveBlockedIds = candidates.filter((c) => blockedProducts.has(c.productId)).map((c) => c.id)
      if (exclusiveBlockedIds.length > 0) {
        listedWhere = { ...where, id: { in: candidates.filter((c) => !blockedProducts.has(c.productId)).map((c) => c.id) } }
      }
    }
    await prisma.affiliateProduct.updateMany({
      where: listedWhere,
      data: { isListed: body.isListed },
    })
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
