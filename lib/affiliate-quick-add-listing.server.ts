import { isDisplayableListingImageUrl } from "@/lib/affiliate-listing-display"
import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { suggestedSellingPriceCents } from "@/lib/affiliate-catalog-margin-display"
import { publishAffiliateListingIfAllowed } from "@/lib/affiliate-publish-listing.server"
import type { MerchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export type QuickAddAffiliateListingInput = {
  affiliateId: string
  productId: string
}

export type QuickAddAffiliateListingResult =
  | {
      ok: true
      listing: { id: string; productId: string; sellingPriceCents: number; isListed: boolean }
      created: boolean
      publishBlocked: MerchantVerificationGate["reason"] | null
    }
  | { ok: false; status: number; error: string }

function listingImagesFromProduct(images: unknown): string[] {
  if (!Array.isArray(images)) return []
  return images
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => isDisplayableListingImageUrl(u))
    .slice(0, 20)
}

async function autoLiveAfterImport(args: {
  affiliateId: string
  listingId: string
}): Promise<{ isListed: boolean; publishBlocked: MerchantVerificationGate["reason"] | null }> {
  const published = await publishAffiliateListingIfAllowed(args)
  if (published.ok) {
    if (!published.alreadyLive) {
      await revalidateAffiliateShopfront(args.affiliateId)
    }
    return { isListed: true, publishBlocked: null }
  }
  if (published.reason === "kyc") {
    return { isListed: false, publishBlocked: published.gate.reason ?? "pending" }
  }
  return { isListed: false, publishBlocked: null }
}

/** Idempotent import + auto-live when KYC allows — vitrine = checkout open. */
export async function quickAddAffiliateListing(
  input: QuickAddAffiliateListingInput
): Promise<QuickAddAffiliateListingResult> {
  const productId = input.productId.trim()
  if (!productId) {
    return { ok: false, status: 400, error: "Missing productId" }
  }

  const existing = await prisma.affiliateProduct.findUnique({
    where: { affiliateId_productId: { affiliateId: input.affiliateId, productId } },
    select: { id: true, productId: true, sellingPriceCents: true, isListed: true },
  })
  if (existing) {
    if (existing.isListed) {
      return {
        ok: true,
        listing: existing,
        created: false,
        publishBlocked: null,
      }
    }
    const live = await autoLiveAfterImport({
      affiliateId: input.affiliateId,
      listingId: existing.id,
    })
    return {
      ok: true,
      listing: { ...existing, isListed: live.isListed },
      created: false,
      publishBlocked: live.publishBlocked,
    }
  }

  const [product, maxPos] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, active: true, isDraft: false },
      select: { id: true, basePriceCents: true, images: true },
    }),
    prisma.affiliateProduct.aggregate({
      where: { affiliateId: input.affiliateId },
      _max: { position: true },
    }),
  ])
  if (!product) {
    return { ok: false, status: 404, error: "Product not found or inactive" }
  }

  const sellingPriceCents = suggestedSellingPriceCents(product.basePriceCents)
  const marginCents = computeAffiliateListingMarginCents(sellingPriceCents, product.basePriceCents)
  const customImages = listingImagesFromProduct(product.images)
  const position = (maxPos._max.position ?? -1) + 1

  const row = await prisma.affiliateProduct.create({
    data: {
      affiliateId: input.affiliateId,
      productId: product.id,
      sellingPriceCents,
      marginCents,
      customImages,
      isListed: false,
      isFeatured: false,
      collections: [],
      buyerRewardKind: "NONE",
      buyerRewardPercent: 0,
      position,
    },
    select: { id: true, productId: true, sellingPriceCents: true, isListed: true },
  })

  const live = await autoLiveAfterImport({
    affiliateId: input.affiliateId,
    listingId: row.id,
  })

  console.log("[affiliate-quick-add]", {
    affiliateId: input.affiliateId,
    productId: product.id,
    listingId: row.id,
    sellingPriceCents,
    isListed: live.isListed,
    publishBlocked: live.publishBlocked,
    result: live.isListed ? "imported_live" : "imported_kyc_blocked",
  })

  return {
    ok: true,
    listing: { ...row, isListed: live.isListed },
    created: true,
    publishBlocked: live.publishBlocked,
  }
}
