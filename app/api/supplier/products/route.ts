import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { findSupplierProductsForOwnerApi } from "@/lib/supplier-product-is-draft-fallback"
import { decimalToNumber } from "@/lib/serialize-for-client"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseProductMarketplaceMeta } from "@/lib/supplier-product-marketplace-meta"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"
import { parseCompareAtDraftLax, parseCompareAtStrict } from "@/lib/supplier-product-compare-at"
import { parseDescriptionBullets } from "@/lib/supplier-product-description-bullets"
import {
  parseDescriptionIllustrationImages,
  parseDescriptionIllustrationVideos,
} from "@/lib/supplier-product-description-illustrations"
import { scheduleProductAutoCategorization } from "@/lib/product-auto-categorize"
import {
  CategoryAttributeValidationError,
  normalizeCategoryAttributeValues,
  validateVisibleCategoryAttributes,
} from "@/lib/category-attribute-rules"
import {
  defaultAffiliateCommissionPct,
  normalizeAffiliateCommissionRatePct,
  parseListingKind,
} from "@/lib/supplier-commission"
import {
  parseCustomColumnsFromBody,
  validateVariantsCustomData,
} from "@/lib/product-custom-columns"
import {
  applyCustomColumnsToVariantRows,
  isSkuVariantsSyncBody,
  parseProductVariantsFromBody,
  syncProductVariants,
} from "@/lib/product-variant-sku"
import type { CustomColumn } from "@/types/product"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const products = await findSupplierProductsForOwnerApi({
    supplierId: session.user.id,
  })
  return Response.json(
    products.map((p) => ({
      ...p,
      compareAt: decimalToNumber(p.compareAt),
      freeShippingThreshold: decimalToNumber(p.freeShippingThreshold),
      shippingCost: decimalToNumber(p.shippingCost) ?? 0,
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden - not supplier" }, { status: 403 })
  }

  const body = await req.json()
  const saveAsDraft = Boolean((body as Record<string, unknown>).saveAsDraft)
  const {
    name,
    basePriceCents: basePriceCentsRaw,
    compareAt: compareAtRaw,
    commissionRate,
    commission,
    description,
    price,
    stock,
  } = body as Record<string, unknown>
  const categoryIdRaw = (body as Record<string, unknown>).categoryId
  const categoryId = typeof categoryIdRaw === "string" ? categoryIdRaw.trim() : ""
  const productAttributesRaw = (body as Record<string, unknown>).productAttributes

  const nameStr = typeof name === "string" ? name.trim() : ""
  if (!saveAsDraft && !nameStr) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  let cents: number
  if (Number.isFinite(Number(price))) {
    cents = Math.round(Number(price) * 100)
  } else if (basePriceCentsRaw != null) {
    cents = Math.round(Number(basePriceCentsRaw))
  } else if (saveAsDraft) {
    cents = 100
  } else {
    cents = 0
  }
  let normalizedPriceCents = Math.max(100, cents || 100)

  const listingKind = parseListingKind((body as Record<string, unknown>).listingKind)
  const commRaw = commission ?? commissionRate
  const commFallback = Number.isFinite(Number(commRaw)) ? Number(commRaw) : defaultAffiliateCommissionPct()
  const normalized = normalizeAffiliateCommissionRatePct(commFallback, listingKind)
  let rate = defaultAffiliateCommissionPct()
  if (normalized.ok) {
    rate = normalized.rate
  } else if (!saveAsDraft) {
    return Response.json({ error: normalized.error }, { status: 400 })
  }

  let compareAt: Prisma.Decimal | null = null
  if (saveAsDraft) {
    compareAt = parseCompareAtDraftLax(normalizedPriceCents, compareAtRaw)
  } else {
    const strict = parseCompareAtStrict(normalizedPriceCents, compareAtRaw)
    if (!strict.ok) {
      return Response.json({ error: strict.error }, { status: 400 })
    }
    compareAt = strict.decimal
  }
  const images = parseSupplierProductImages(body as Record<string, unknown>)
  const attr = parseProductAttributesBody(body as Record<string, unknown>)
  const ship = parseSupplierProductShippingBody(body as Record<string, unknown>)
  const meta = parseProductMarketplaceMeta(body as Record<string, unknown>)
  const desc = typeof description === "string" ? description.trim() : ""
  const descriptionBullets = parseDescriptionBullets(
    (body as Record<string, unknown>).descriptionBullets
  )
  const descriptionIllustrationImages = parseDescriptionIllustrationImages(body as Record<string, unknown>)
  const descriptionIllustrationVideos = parseDescriptionIllustrationVideos(body as Record<string, unknown>)
  const stockN = Math.max(0, Math.round(Number.isFinite(Number(stock)) ? Number(stock) : 0))

  const productAttributes = Array.isArray(productAttributesRaw)
    ? productAttributesRaw
        .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
        .filter((row): row is Record<string, unknown> => row != null)
        .map((row) => ({
          key: String(row.key ?? "").trim(),
          label: String(row.label ?? row.key ?? "").trim(),
          value: String(row.value ?? "").trim(),
        }))
        .filter((r) => r.key.length > 0 && r.value.length > 0)
    : []

  const supplierId = (session.user as { id: string }).id
  const displayName = (nameStr || "Untitled draft").slice(0, 500)

  if (!saveAsDraft && categoryId) {
    const attributeValuesRaw = (body as Record<string, unknown>).attributeValues
    const valuesInput =
      productAttributes.length > 0
        ? productAttributes
        : attributeValuesRaw && typeof attributeValuesRaw === "object"
          ? normalizeCategoryAttributeValues(
              attributeValuesRaw as Record<string, unknown> | Array<{ key?: unknown; value?: unknown }>
            )
          : {}

    try {
      await validateVisibleCategoryAttributes(categoryId, valuesInput)
    } catch (err) {
      if (err instanceof CategoryAttributeValidationError) {
        return Response.json({ error: err.message, errors: err.errors }, { status: 400 })
      }
      throw err
    }
  }

  const customColumnsParsed = parseCustomColumnsFromBody(body as Record<string, unknown>)
  if (!Array.isArray(customColumnsParsed)) {
    return Response.json({ error: customColumnsParsed.error }, { status: 400 })
  }
  const customColumns = customColumnsParsed

  let variantSync: { hasVariants: boolean; variants: import("@/lib/product-variant-sku").ProductVariantInput[] } | null =
    null
  if (isSkuVariantsSyncBody(body as Record<string, unknown>)) {
    const bodyRecord = body as Record<string, unknown>
    const rawVariants = Array.isArray(bodyRecord.variants) ? bodyRecord.variants : []
    const customErr = validateVariantsCustomData(customColumns, rawVariants)
    if (customErr) {
      return Response.json({ error: customErr }, { status: 400 })
    }

    const variantPatch = parseProductVariantsFromBody(bodyRecord)
    if ("error" in variantPatch) {
      return Response.json(
        { error: variantPatch.error, issues: variantPatch.issues },
        { status: 400 }
      )
    }
    variantSync = {
      ...variantPatch,
      variants: applyCustomColumnsToVariantRows(variantPatch.variants, customColumns, rawVariants),
    }
    if (variantSync.hasVariants && variantSync.variants.length > 0) {
      const minEur = Math.min(...variantSync.variants.map((v) => v.supplierPrice))
      if (Number.isFinite(minEur) && minEur > 0) {
        normalizedPriceCents = Math.max(100, Math.round(minEur * 100))
      }
    } else if (!saveAsDraft && cents <= 0) {
      return Response.json({ error: "Missing price" }, { status: 400 })
    }
  } else if (!saveAsDraft && cents <= 0) {
    return Response.json({ error: "Missing price" }, { status: 400 })
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        supplierId,
        name: saveAsDraft ? displayName : nameStr.slice(0, 500),
        description: desc,
        descriptionBullets,
        descriptionIllustrationImages,
        descriptionIllustrationVideos,
        images,
        colorImages:
          attr.colorImages === null
            ? Prisma.DbNull
            : (attr.colorImages as unknown as Prisma.InputJsonValue),
        categories: attr.categories,
        colors: attr.colors,
        tags: attr.tags,
        variants:
          attr.variants === null
            ? Prisma.DbNull
            : (attr.variants as unknown as Prisma.InputJsonValue),
        basePriceCents: normalizedPriceCents,
        compareAt,
        commissionRate: rate,
        listingKind,
        stock: stockN,
        active: !saveAsDraft,
        isDraft: saveAsDraft,
        categoryId: categoryId || null,
        shippingCountry: ship.shippingCountry,
        warehouseType: ship.warehouseType,
        warehouseCity: ship.warehouseCity,
        processingTime: ship.processingTime,
        deliveryMin: ship.deliveryMin,
        deliveryMax: ship.deliveryMax,
        shippingMethods: ship.shippingMethods,
        freeShippingThreshold: ship.freeShippingThreshold,
        shippingCost: ship.shippingCost,
        shipsFrom: meta.shipsFrom,
        deliveryDays: meta.deliveryDays,
        freeShipping: meta.freeShipping,
        supplierTag: meta.supplierTag,
        customColumns:
          customColumns.length > 0
            ? (customColumns as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
    })

    if (productAttributes.length) {
      await tx.productAttribute.createMany({
        data: productAttributes.map((a) => ({
          productId: created.id,
          key: a.key,
          label: a.label || a.key,
          value: a.value,
        })),
        skipDuplicates: true,
      })
    }

    if (variantSync?.hasVariants) {
      await syncProductVariants(tx, created.id, true, variantSync.variants)
    } else if (variantSync && !variantSync.hasVariants) {
      await syncProductVariants(tx, created.id, false, [])
    }

    return created
  })

  if (!saveAsDraft) {
    const supplierStore = await prisma.store.findUnique({
      where: { userId: (session.user as { id: string }).id },
      select: { id: true },
    })
    if (supplierStore) {
      try {
        await createNewDropCommunityPost({
          storeId: supplierStore.id,
          productId: product.id,
          productName: product.name,
        })
      } catch {
        /* non-fatal */
      }
    }
    if (!categoryId) {
      scheduleProductAutoCategorization(product.id)
    }
  }

  return Response.json(product, { status: 201 })
}
