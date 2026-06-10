import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { findSupplierProductsForOwnerApi } from "@/lib/supplier-product-is-draft-fallback"
import { decimalToNumber } from "@/lib/serialize-for-client"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseProductMarketplaceMeta } from "@/lib/supplier-product-marketplace-meta"
import {
  parseProductOfferBody,
  resolveSupplierCatalogPriceCents,
} from "@/lib/supplier-product-offer-mode"
import { validateOfferModePublish } from "@/lib/product-offer-mode"
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
import { normalizeLeafCategoryId } from "@/lib/category-leaf-guard"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { requireMerchantUserId } from "@/lib/merchant-tenant-scope"
import { onSupplierProductPublishedFromInvite } from "@/lib/supplier-invitation"
import { parseListingKind } from "@/lib/supplier-commission"
import {
  parseProductDigitalDeliveryBody,
  validateDigitalDeliveryForPublish,
} from "@/lib/digital-delivery/parse-product-digital"
import { parseProductBookingBody } from "@/lib/booking/parse-product-booking"
import {
  isBookableListingKind,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/types"
import { parseAffisellCommissionOverrideFromBody } from "@/lib/supplier-product-affisell-commission-override"
import { productCommissionRateForSave } from "@/lib/supplier-product-commission-save"
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
import { parseChinaImportFields } from "@/lib/china-buying/china-buying-shared"
import { routeChinaBuy } from "@/lib/china-buying/route-china-buy"
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
  const products = await findSupplierProductsForOwnerApi(session.user.id)
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

  if (!saveAsDraft) {
    const gate = await merchantVerificationGate(session.user.id)
    if (!gate.allowed) {
      return Response.json(
        { error: "merchant_verification_pending", verificationStatus: gate.status },
        { status: 403 }
      )
    }
  }
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
  let categoryId = ""
  try {
    categoryId = (await normalizeLeafCategoryId(categoryIdRaw)) ?? ""
  } catch (e) {
    if (e instanceof Error && e.message === "CATEGORY_NOT_FOUND") {
      return Response.json({ error: "Unknown category" }, { status: 400 })
    }
    if (e instanceof Error && e.message === "CATEGORY_NOT_LEAF") {
      return Response.json({ error: "Category must be a leaf node" }, { status: 400 })
    }
    throw e
  }
  const affisellOverrideBps = parseAffisellCommissionOverrideFromBody(
    (body as Record<string, unknown>).affisellCommissionRateOverridePercent ??
      (body as Record<string, unknown>).affisellCommissionRateOverrideBps
  )
  const productAttributesRaw = (body as Record<string, unknown>).productAttributes

  const nameStr = typeof name === "string" ? name.trim() : ""
  if (!saveAsDraft && !nameStr) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  const offer = parseProductOfferBody(body as Record<string, unknown>)

  let cents: number
  if (Number.isFinite(Number(price))) {
    cents = Math.round(Number(price) * 100)
  } else if (basePriceCentsRaw != null) {
    cents = Math.round(Number(basePriceCentsRaw))
  } else if (saveAsDraft) {
    cents = offer.offerMode === "DONATION" ? 0 : 100
  } else {
    cents = 0
  }
  let normalizedPriceCents = resolveSupplierCatalogPriceCents(offer.offerMode, cents, saveAsDraft)

  const listingKind = parseListingKind((body as Record<string, unknown>).listingKind)
  const digitalParsed = parseProductDigitalDeliveryBody(body as Record<string, unknown>)
  if (!digitalParsed.ok) {
    return Response.json({ error: "invalid_digital_delivery" }, { status: 400 })
  }
  const bookingParsed = parseProductBookingBody(body as Record<string, unknown>)
  const digitalErr = validateDigitalDeliveryForPublish(
    listingKind,
    digitalParsed.data,
    saveAsDraft
  )
  if (digitalErr) {
    return Response.json({ error: digitalErr }, { status: 400 })
  }
  if (!saveAsDraft && isBookableListingKind(listingKind) && isBookingCheckoutLiveForKind(listingKind)) {
    return Response.json({ error: "booking_slots_required" }, { status: 400 })
  }
  const commRaw = commission ?? commissionRate

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

  const supplierId = requireMerchantUserId(session.user.id, "supplier")
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
    if (!saveAsDraft) {
      return Response.json({ error: customColumnsParsed.error }, { status: 400 })
    }
  }
  const customColumns = Array.isArray(customColumnsParsed) ? customColumnsParsed : []

  let variantSync: { hasVariants: boolean; variants: import("@/lib/product-variant-sku").ProductVariantInput[] } | null =
    null
  if (isSkuVariantsSyncBody(body as Record<string, unknown>)) {
    const bodyRecord = body as Record<string, unknown>
    const rawVariants = Array.isArray(bodyRecord.variants) ? bodyRecord.variants : []
    const customErr = validateVariantsCustomData(customColumns, rawVariants)
    if (customErr && !saveAsDraft) {
      return Response.json({ error: customErr }, { status: 400 })
    }

    const variantPatch = parseProductVariantsFromBody(bodyRecord)
    if ("error" in variantPatch) {
      if (!saveAsDraft) {
        return Response.json(
          { error: variantPatch.error, issues: variantPatch.issues },
          { status: 400 }
        )
      }
    } else {
      variantSync = {
        ...variantPatch,
        variants: applyCustomColumnsToVariantRows(variantPatch.variants, customColumns, rawVariants),
      }
      if (variantSync.hasVariants && variantSync.variants.length > 0) {
        const minEur = Math.min(...variantSync.variants.map((v) => v.supplierPrice))
        if (Number.isFinite(minEur) && minEur > 0) {
          normalizedPriceCents = resolveSupplierCatalogPriceCents(
            offer.offerMode,
            Math.round(minEur * 100),
            saveAsDraft
          )
        }
      } else if (!saveAsDraft && cents <= 0 && offer.offerMode !== "DONATION") {
        return Response.json({ error: "Missing price" }, { status: 400 })
      }
    }
  } else if (!saveAsDraft && cents <= 0 && offer.offerMode !== "DONATION") {
    return Response.json({ error: "Missing price" }, { status: 400 })
  }

  if (!saveAsDraft) {
    const offerErr = validateOfferModePublish(offer.offerMode, offer.minOrderQuantity)
    if (offerErr) {
      return Response.json({ error: offerErr }, { status: 400 })
    }
  }

  const variantCommissionRates =
    variantSync?.hasVariants && variantSync.variants.length > 0
      ? variantSync.variants.map((v) => v.commissionRate)
      : undefined
  const commissionResolved = productCommissionRateForSave({
    topLevelRaw: commRaw,
    variantCommissionRates,
    listingKind,
  })
  let rate = 0
  if (commissionResolved.ok) {
    rate = commissionResolved.rate
  } else if (!saveAsDraft) {
    return Response.json({ error: commissionResolved.error }, { status: 400 })
  }

  const chinaImport = parseChinaImportFields(body as Record<string, unknown>)

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
        digitalAccessUrl: digitalParsed.data.digitalAccessUrl,
        digitalAccessInstructions: digitalParsed.data.digitalAccessInstructions,
        digitalInstantDelivery: digitalParsed.data.digitalInstantDelivery,
        bookingDurationMinutes: bookingParsed.bookingDurationMinutes,
        bookingCancellationHours: bookingParsed.bookingCancellationHours,
        bookingVenueLabel: bookingParsed.bookingVenueLabel,
        bookingInstantConfirm: bookingParsed.bookingInstantConfirm,
        ...(bookingParsed.bookingSeatLayout !== undefined
          ? {
              bookingSeatLayout:
                bookingParsed.bookingSeatLayout === null
                  ? Prisma.DbNull
                  : (bookingParsed.bookingSeatLayout as Prisma.InputJsonValue),
            }
          : {}),
        stock: stockN,
        active: !saveAsDraft,
        isDraft: saveAsDraft,
        categoryId: categoryId || null,
        ...(affisellOverrideBps !== undefined
          ? { affisellCommissionRateOverrideBps: affisellOverrideBps }
          : {}),
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
        isLuxury: meta.isLuxury,
        supplierTag: meta.supplierTag,
        offerMode: offer.offerMode,
        minOrderQuantity: offer.minOrderQuantity,
        isRefurbished: offer.isRefurbished,
        customColumns:
          customColumns.length > 0
            ? (customColumns as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        ...(chinaImport.sourceUrl ? { sourceUrl: chinaImport.sourceUrl } : {}),
        ...(chinaImport.chinaBuyingAgentId
          ? { chinaBuyingAgentId: chinaImport.chinaBuyingAgentId }
          : {}),
        ...(chinaImport.chinaPlatform ? { chinaPlatform: chinaImport.chinaPlatform } : {}),
        ...(chinaImport.importSource ? { importSource: chinaImport.importSource } : {}),
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

  if (chinaImport.sourceUrl && chinaImport.chinaBuyingAgentId) {
    void routeChinaBuy({
      supplierId,
      sourceUrl: chinaImport.sourceUrl,
      agentId: chinaImport.chinaBuyingAgentId,
      platform: chinaImport.chinaPlatform,
      productId: product.id,
    })
  }

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

    void onSupplierProductPublishedFromInvite({
      supplierId,
      productId: product.id,
      productName: product.name,
      commissionRate: product.commissionRate,
      variants: product.variants,
      basePriceCents: product.basePriceCents,
      images: product.images,
    }).catch((e) => console.error("[supplier-invite] publish hook", e))
  }

  return Response.json(product, { status: 201 })
}
