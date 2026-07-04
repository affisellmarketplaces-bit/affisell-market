import { NextResponse } from "next/server"

import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { parsePromotedVariantPatch } from "@/lib/affiliate-promoted-variant"
import { parsePromotedVariantKeysBody } from "@/lib/affiliate-storefront-variants"
import { resolveBuyerRewardForListing } from "@/lib/affiliate-buyer-reward-request"
import { buildLuxuryListingPatch } from "@/lib/luxury-listing-patch"
import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { slugifyListingSlug } from "@/lib/affiliate-listing-display"
import { parseShowWarrantyFlag, resolveProductWarrantyMonths } from "@/lib/product-warranty"
import { removeAffiliateListingsFromStorefront } from "@/lib/affiliate-listing-remove"
import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { resolveVariantPricingBodyForProduct } from "@/lib/affiliate-variant-pricing-request"
import {
  buildWholesaleSnapshot,
  listingMarginReviewIsResolved,
  parseListingVariantPricing,
} from "@/lib/affiliate-wholesale-change-guard"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Owner (or admin) read for dashboard / tooling — no secrets beyond listing + product catalog fields. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = String((session.user as { role?: string }).role ?? "").toUpperCase()
  if (role !== "AFFILIATE" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const listing = await prisma.affiliateProduct.findFirst({
    where:
      role === "ADMIN"
        ? { id }
        : {
            id,
            affiliateId: session.user.id,
          },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          images: true,
          basePriceCents: true,
          variants: true,
          commissionRate: true,
          listingKind: true,
          active: true,
          supplier: { select: { isVerifiedSupplier: true } },
          category: { select: { fullPath: true, name: true } },
          attributes: { select: { key: true, label: true, value: true } },
        },
      },
    },
  })

  if (!listing || !listing.product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    listing: {
      id: listing.id,
      productId: listing.productId,
      sellingPriceCents: listing.sellingPriceCents,
      isListed: listing.isListed,
      customTitle: listing.customTitle,
      customDescription: listing.customDescription,
      customSlug: listing.customSlug,
      seoTitle: listing.seoTitle,
      seoDescription: listing.seoDescription,
      customImages: listing.customImages,
    },
    product: listing.product,
  })
}

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

  const luxuryPatch = await buildLuxuryListingPatch(body)
  if (!luxuryPatch.ok) {
    return NextResponse.json({ error: luxuryPatch.error }, { status: luxuryPatch.status })
  }
  Object.assign(data, luxuryPatch.data)

  if (typeof body.listInStore === "boolean") data.isListed = body.listInStore
  if (typeof body.isListed === "boolean") data.isListed = body.isListed
  if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured
  if (typeof body.auctionEligible === "boolean") data.auctionEligible = body.auctionEligible

  let nextSellingCents = listing.sellingPriceCents
  if (typeof data.sellingPriceCents === "number") {
    nextSellingCents = data.sellingPriceCents
    data.marginCents = computeAffiliateListingMarginCents(
      nextSellingCents,
      listing.product.basePriceCents
    )
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

  const productVariantRows = await prisma.productVariant.findMany({
    where: { productId: listing.productId },
    select: {
      color: true,
      size: true,
      stock: true,
      supplierPrice: true,
      wholesalePriceCents: true,
      customData: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const productForPromo = {
    colors: Array.isArray(listing.product.colors)
      ? listing.product.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
      : [],
    variants: listing.product.variants,
    hasVariants: listing.product.hasVariants,
    basePriceCents: listing.product.basePriceCents,
    productVariants: productVariantRows.map(({ customData: _c, ...v }) => v),
  }

  const promo = parsePromotedVariantPatch(productForPromo, body)
  if ("error" in promo) {
    return NextResponse.json({ error: promo.error }, { status: 400 })
  }
  Object.assign(data, promo)

  if ("promotedVariantKeys" in body) {
    const keysRes = parsePromotedVariantKeysBody(productForPromo, body.promotedVariantKeys)
    if ("error" in keysRes) {
      return NextResponse.json({ error: keysRes.error }, { status: 400 })
    }
    data.promotedVariantKeys = keysRes.promotedVariantKeys
  }

  const showWarrantyFlag = parseShowWarrantyFlag(body.showWarranty)
  if (showWarrantyFlag !== undefined) {
    if (showWarrantyFlag) {
      const warrantyMonths = resolveProductWarrantyMonths({
        variants: listing.product.variants,
        hasVariants: listing.product.hasVariants,
        productVariants: productVariantRows.map(({ customData }) => ({ customData })),
      })
      if (warrantyMonths == null || warrantyMonths <= 0) {
        return NextResponse.json(
          { error: "Ce produit n'a pas de garantie fournisseur à afficher." },
          { status: 400 }
        )
      }
    }
    data.showWarranty = showWarrantyFlag
  }

  if ("variantPricing" in body) {
    const pricingRes = resolveVariantPricingBodyForProduct({
      raw: body.variantPricing,
      product: productForPromo,
    })
    if ("error" in pricingRes) {
      return NextResponse.json({ error: pricingRes.error }, { status: 400 })
    }
    data.variantPricing =
      pricingRes.variantPricing === null
        ? Prisma.DbNull
        : (pricingRes.variantPricing as Prisma.InputJsonValue)
  }

  if (typeof body.pricingAutoAdjust === "boolean") {
    data.pricingAutoAdjust = body.pricingAutoAdjust
    if (!body.pricingAutoAdjust) {
      data.pricingAutoAdjustLastRun = null
    }
  }

  const nextListed =
    typeof body.listInStore === "boolean"
      ? body.listInStore
      : typeof body.isListed === "boolean"
        ? body.isListed
        : listing.isListed

  const nextAuctionEligible =
    typeof body.auctionEligible === "boolean" ? body.auctionEligible : listing.auctionEligible

  if (nextAuctionEligible && !nextListed) {
    return NextResponse.json(
      { error: "List this product on your storefront before adding it to Auction Arena." },
      { status: 400 }
    )
  }

  if (nextListed && !listing.isListed) {
    const kycBlocked = await requireMerchantVerifiedForPublish(session.user.id)
    if (kycBlocked) return kycBlocked
  }

  const nextVariantPricing =
    "variantPricing" in body
      ? parseListingVariantPricing(
          data.variantPricing === Prisma.DbNull ? null : data.variantPricing
        )
      : parseListingVariantPricing(listing.variantPricing)
  const wholesaleAfter = buildWholesaleSnapshot(productForPromo)
  if (
    listingMarginReviewIsResolved({
      sellingPriceCents: nextSellingCents,
      variantPricing: nextVariantPricing,
      wholesaleAfter,
    })
  ) {
    if (listing.marginReviewNeeded) {
      console.log("[margin-auto-fix]", {
        listingId: id,
        affiliateId: session.user.id,
        result: "cleared",
      })
    }
    data.marginReviewNeeded = false
    data.marginReviewVariantKeys = []
    data.marginReviewAt = null
  }

  try {
    const updated = await prisma.affiliateProduct.update({
      where: { id },
      data,
    })
    if (!nextListed || !nextAuctionEligible) {
      await cancelAuctionsForListings([id])
    }
    await revalidateAffiliateShopfront(session.user.id)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 })
    }
    throw e
  }
}

/** Remove this listing from the affiliate storefront (delete or hide if orders exist). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String((session.user as { role?: string }).role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const result = await removeAffiliateListingsFromStorefront(session.user.id, [id])
  if (result.deletedIds.length === 0 && result.hiddenIds.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, ...result })
}
