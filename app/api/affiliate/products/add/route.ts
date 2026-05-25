import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { parsePromotedVariantPatch } from "@/lib/affiliate-promoted-variant"
import { parsePromotedVariantKeysBody } from "@/lib/affiliate-storefront-variants"
import { resolveBuyerRewardForListing } from "@/lib/affiliate-buyer-reward-request"
import { slugifyListingSlug } from "@/lib/affiliate-listing-display"
import { parseShowWarrantyFlag, resolveProductWarrantyMonths } from "@/lib/product-warranty"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLLECTION_ALLOWED = new Set(["Featured", "Black Friday", "Tech Deals"])

function parseCollections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => COLLECTION_ALLOWED.has(s))
    .slice(0, 6)
}

function mergeCustomImages(productImages: string[], body: Record<string, unknown>): string[] {
  const useAll = body.useAllSupplierImages === true
  if (useAll) return [...productImages].filter(Boolean).slice(0, 20)

  const selected = Array.isArray(body.supplierImagesSelectedUrls)
    ? (body.supplierImagesSelectedUrls as unknown[]).filter((x): x is string => typeof x === "string")
    : []
  const extras = Array.isArray(body.additionalImageUrls)
    ? (body.additionalImageUrls as unknown[]).filter((x): x is string => typeof x === "string")
    : []
  const normalized = [...new Set([...selected, ...extras].map((s) => s.trim()).filter(Boolean))].slice(0, 20)
  return normalized.length > 0 ? normalized : [...productImages].filter(Boolean).slice(0, 20)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const euroRaw = body.sellingPriceEUR ?? body.yourPriceEUR
  let sellingPriceCents: number | undefined =
    typeof body.sellingPriceCents === "number" && Number.isFinite(body.sellingPriceCents)
      ? Math.round(body.sellingPriceCents)
      : undefined
  if (typeof euroRaw === "number" && Number.isFinite(euroRaw)) {
    sellingPriceCents = Math.round(euroRaw * 100)
  }

  const product = await prisma.product.findFirst({ where: { id: productId, active: true } })
  if (!product) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })
  }

  /** Save Draft → keep listing off the public storefront */
  const saveDraft = body.saveDraft === true

  if (saveDraft) {
    if (sellingPriceCents === undefined || !Number.isFinite(sellingPriceCents)) {
      sellingPriceCents = product.basePriceCents
    }
    if (sellingPriceCents < product.basePriceCents) {
      sellingPriceCents = product.basePriceCents
    }
  } else {
    if (sellingPriceCents === undefined || !Number.isFinite(sellingPriceCents)) {
      return NextResponse.json({ error: "Missing selling price" }, { status: 400 })
    }
    if (sellingPriceCents < product.basePriceCents) {
      return NextResponse.json(
        { error: `Your price must be at least supplier base (${(product.basePriceCents / 100).toFixed(2)} EUR)` },
        { status: 400 }
      )
    }
  }

  const customTitleRaw = typeof body.customTitle === "string" ? body.customTitle.trim() : ""
  const customTitle = customTitleRaw ? customTitleRaw.slice(0, 200) : null

  const customDescriptionRaw =
    typeof body.customDescription === "string" ? body.customDescription.trim().slice(0, 16000) : ""
  const customDescription = customDescriptionRaw.length > 0 ? customDescriptionRaw : null

  const customImages = mergeCustomImages(product.images as string[], body)

  let customSlugStr: string | null = null
  if (typeof body.customSlug === "string" && body.customSlug.trim()) {
    const s = slugifyListingSlug(body.customSlug)
    if (s.length > 0) customSlugStr = s.slice(0, 64)
  }

  const seoTitle = typeof body.seoTitle === "string" ? body.seoTitle.trim().slice(0, 60) : ""
  const seoDescription = typeof body.seoDescription === "string" ? body.seoDescription.trim().slice(0, 160) : ""

  const collections = parseCollections(body.collections)
  const listToggle =
    typeof body.listInStore === "boolean"
      ? body.listInStore
      : typeof body.isListed === "boolean"
        ? body.isListed
        : true

  const publishExplicit =
    typeof body.publish === "boolean"
      ? body.publish
      : typeof body.publishToStore === "boolean"
        ? body.publishToStore
        : undefined

  const wantsPublicListing = saveDraft
    ? false
    : typeof publishExplicit === "boolean"
      ? publishExplicit
      : true

  const isListed = wantsPublicListing && listToggle

  const isFeatured = typeof body.isFeatured === "boolean" ? body.isFeatured : collections.includes("Featured")

  const maxPos = await prisma.affiliateProduct.aggregate({
    where: { affiliateId: session.user.id },
    _max: { position: true },
  })
  const maxP = maxPos._max.position
  const position = (maxP == null ? -1 : maxP) + 1

  const existingRow = await prisma.affiliateProduct.findUnique({
    where: { affiliateId_productId: { affiliateId: session.user.id, productId } },
    select: { buyerRewardKind: true, buyerRewardPercent: true },
  })

  const rewardRes = resolveBuyerRewardForListing({
    body,
    basePriceCents: product.basePriceCents,
    nextSellingCents: sellingPriceCents,
    existingKind: existingRow?.buyerRewardKind,
    existingPercent: existingRow?.buyerRewardPercent,
  })
  if ("error" in rewardRes && !saveDraft) {
    return NextResponse.json({ error: rewardRes.error }, { status: 400 })
  }

  const productForPromo = {
    colors: Array.isArray(product.colors)
      ? product.colors.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
      : [],
    variants: product.variants,
    hasVariants: product.hasVariants,
    productVariants: await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { color: true, size: true, stock: true },
      orderBy: { createdAt: "asc" },
    }),
  }

  const promo = parsePromotedVariantPatch(productForPromo, body)
  if ("error" in promo && !saveDraft) {
    return NextResponse.json({ error: promo.error }, { status: 400 })
  }

  let promotedVariantKeys: string[] | undefined
  if ("promotedVariantKeys" in body) {
    const keysRes = parsePromotedVariantKeysBody(productForPromo, body.promotedVariantKeys)
    if ("error" in keysRes && !saveDraft) {
      return NextResponse.json({ error: keysRes.error }, { status: 400 })
    }
    if (!("error" in keysRes)) {
      promotedVariantKeys = keysRes.promotedVariantKeys
    }
  }

  const reward =
    "error" in rewardRes
      ? { buyerRewardKind: "NONE" as const, buyerRewardPercent: 0 }
      : rewardRes
  const promoPatch = "error" in promo ? {} : promo
  const keysPatch =
    promotedVariantKeys !== undefined ? { promotedVariantKeys } : {}

  const showWarrantyFlag = parseShowWarrantyFlag(body.showWarranty)
  let showWarranty = false
  if (showWarrantyFlag === true) {
    const warrantyMonths = resolveProductWarrantyMonths({
      variants: product.variants,
      hasVariants: product.hasVariants,
      productVariants: await prisma.productVariant.findMany({
        where: { productId: product.id },
        select: { customData: true },
      }),
    })
    if ((warrantyMonths == null || warrantyMonths <= 0) && !saveDraft) {
      return NextResponse.json(
        { error: "Ce produit n'a pas de garantie fournisseur à afficher." },
        { status: 400 }
      )
    }
    showWarranty = warrantyMonths != null && warrantyMonths > 0
  }

  try {
    const row = await prisma.affiliateProduct.upsert({
      where: {
        affiliateId_productId: { affiliateId: session.user.id, productId },
      },
      create: {
        affiliateId: session.user.id,
        productId,
        sellingPriceCents,
        customTitle,
        customDescription,
        customImages,
        customSlug: customSlugStr,
        seoTitle: seoTitle.length ? seoTitle : null,
        seoDescription: seoDescription.length ? seoDescription : null,
        collections,
        isListed,
        isFeatured,
        position,
        buyerRewardKind: reward.buyerRewardKind,
        buyerRewardPercent: reward.buyerRewardPercent,
        showWarranty,
        ...promoPatch,
        ...keysPatch,
      },
      update: {
        sellingPriceCents,
        customTitle,
        customDescription,
        customImages,
        customSlug: customSlugStr ?? undefined,
        seoTitle: seoTitle.length ? seoTitle : undefined,
        seoDescription: seoDescription.length ? seoDescription : undefined,
        collections,
        isListed,
        isFeatured,
        buyerRewardKind: reward.buyerRewardKind,
        buyerRewardPercent: reward.buyerRewardPercent,
        showWarranty,
        ...promoPatch,
        ...keysPatch,
      },
    })

    if (isListed && !saveDraft) {
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
    }

    return NextResponse.json(row, { status: 201 })
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already in use in your store" }, { status: 409 })
    }
    throw e
  }
}
