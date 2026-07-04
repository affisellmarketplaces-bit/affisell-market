import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import {
  adjustVariantPricingForDailyCron,
  startOfUtcDay,
  utcDateKey,
} from "@/lib/affiliate-ai-variant-pricing"
import { parseAffiliateVariantPricingJson, serializeVariantPricingForDb } from "@/lib/affiliate-variant-pricing"
import { buildAffiliateVariantOptions } from "@/lib/affiliate-storefront-variants"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BATCH = 80

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const todayStart = startOfUtcDay()
  const dateKey = utcDateKey()

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      pricingAutoAdjust: true,
      isListed: true,
      OR: [{ pricingAutoAdjustLastRun: null }, { pricingAutoAdjustLastRun: { lt: todayStart } }],
    },
    take: BATCH,
    orderBy: { updatedAt: "asc" },
    include: {
      product: {
        select: {
          id: true,
          colors: true,
          variants: true,
          basePriceCents: true,
          hasVariants: true,
        },
      },
    },
  })

  let adjusted = 0
  let skipped = 0
  let variantsTouched = 0

  for (const listing of listings) {
    const variantPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
    const keys = Object.keys(variantPricing)
    if (keys.length === 0) {
      skipped++
      continue
    }

    const productVariants = await prisma.productVariant.findMany({
      where: { productId: listing.productId },
      select: {
        color: true,
        size: true,
        stock: true,
        supplierPrice: true,
        wholesalePriceCents: true,
      },
      orderBy: { createdAt: "asc" },
    })

    const options = buildAffiliateVariantOptions({
      colors: Array.isArray(listing.product.colors)
        ? listing.product.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
        : [],
      variants: listing.product.variants,
      basePriceCents: listing.product.basePriceCents,
      hasVariants: listing.product.hasVariants,
      productVariants,
    })
    const wholesaleByKey = new Map(options.map((o) => [o.key, o.wholesaleCents]))

    const { next, changed } = adjustVariantPricingForDailyCron({
      listingId: listing.id,
      variantPricing,
      wholesaleByKey,
      dateKey,
    })

    if (changed.length === 0) {
      await prisma.affiliateProduct.update({
        where: { id: listing.id },
        data: { pricingAutoAdjustLastRun: new Date() },
      })
      skipped++
      continue
    }

    const serialized = serializeVariantPricingForDb(next)
    await prisma.affiliateProduct.update({
      where: { id: listing.id },
      data: {
        variantPricing:
          serialized === null ? Prisma.DbNull : (serialized as Prisma.InputJsonValue),
        pricingAutoAdjustLastRun: new Date(),
      },
    })

    console.log("[variant-pricing-cron]", {
      listingId: listing.id,
      productId: listing.productId,
      result: "adjusted",
      variants: changed.map((c) => ({
        key: c.key,
        oldCents: c.oldCents,
        newCents: c.newCents,
      })),
    })

    await revalidateAffiliateShopfront(listing.affiliateId)
    adjusted++
    variantsTouched += changed.length
  }

  console.log("[variant-pricing-cron]", {
    scanned: listings.length,
    adjusted,
    skipped,
    variantsTouched,
    dateKey,
  })

  return NextResponse.json({
    ok: true,
    scanned: listings.length,
    adjusted,
    skipped,
    variantsTouched,
    dateKey,
  })
}
