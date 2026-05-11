import { NextResponse } from "next/server"

import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { resolveBuyerRewardForListing } from "@/lib/affiliate-buyer-reward-request"
import { slugifyListingSlug } from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLLECTION_ALLOWED = new Set(["Featured", "Black Friday", "Tech Deals"])

function parseCollections(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => COLLECTION_ALLOWED.has(s))
    .slice(0, 6)
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, affiliateId: session.user.id },
    include: { product: true },
  })
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const data: Prisma.AffiliateProductUpdateInput = {}

  if (
    typeof body.sellingPriceCents === "number" &&
    Number.isFinite(body.sellingPriceCents)
  ) {
    const cents = Math.round(body.sellingPriceCents)
    if (cents < listing.product.basePriceCents) {
      return NextResponse.json({ error: "Price must be ≥ supplier base price" }, { status: 400 })
    }
    data.sellingPriceCents = cents
  }

  const euroRaw =
    typeof body.sellingPriceEUR === "number"
      ? body.sellingPriceEUR
      : typeof body.yourPriceEUR === "number"
        ? body.yourPriceEUR
        : NaN
  if (typeof euroRaw === "number" && Number.isFinite(euroRaw)) {
    const cents = Math.round(euroRaw * 100)
    if (cents < listing.product.basePriceCents) {
      return NextResponse.json({ error: "Price must be ≥ supplier base price" }, { status: 400 })
    }
    data.sellingPriceCents = cents
  }

  if (typeof body.customTitle === "string") {
    const t = body.customTitle.trim()
    data.customTitle = t.slice(0, 200).length ? t.slice(0, 200) : null
  }

  if (typeof body.customDescription === "string") {
    const d = body.customDescription.trim().slice(0, 16000)
    data.customDescription = d.length ? d : null
  }

  if (Array.isArray(body.customImages)) {
    data.customImages = (body.customImages as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 20)
  }

  if (typeof body.customSlug === "string") {
    const raw = body.customSlug.trim()
    data.customSlug = raw ? slugifyListingSlug(raw).slice(0, 64) : null
  }

  if (typeof body.seoTitle === "string") {
    data.seoTitle = body.seoTitle.trim().slice(0, 60) || null
  }
  if (typeof body.seoDescription === "string") {
    data.seoDescription = body.seoDescription.trim().slice(0, 160) || null
  }

  const cols = parseCollections(body.collections)
  if (cols !== undefined) data.collections = cols

  if (typeof body.listInStore === "boolean") data.isListed = body.listInStore
  if (typeof body.isListed === "boolean") data.isListed = body.isListed
  if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured

  let nextSellingCents = listing.sellingPriceCents
  if (typeof data.sellingPriceCents === "number") {
    nextSellingCents = data.sellingPriceCents
  }

  const rewardRes = resolveBuyerRewardForListing({
    body,
    basePriceCents: listing.product.basePriceCents,
    nextSellingCents,
    existingKind: listing.buyerRewardKind,
    existingPercent: listing.buyerRewardPercent,
  })
  if ("error" in rewardRes) {
    return NextResponse.json({ error: rewardRes.error }, { status: 400 })
  }
  data.buyerRewardKind = rewardRes.buyerRewardKind
  data.buyerRewardPercent = rewardRes.buyerRewardPercent

  try {
    const updated = await prisma.affiliateProduct.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 })
    }
    throw e
  }
}
