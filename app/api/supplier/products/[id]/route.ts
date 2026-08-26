import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { SUPPLIER_PRODUCT_WRITE_TX } from "@/lib/prisma-transaction-options"
import { loadSupplierProductForPut } from "@/lib/supplier-product-put-load"
import {
  applySupplierProductVisibilityFlags,
  isSupplierProductResellerVisible,
} from "@/lib/supplier-product-visibility-flags"
import { onSupplierProductPublishedFromInvite } from "@/lib/supplier-invitation"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { scheduleProductAutoCategorization } from "@/lib/product-auto-categorize"
import {
  normalizeProductAttributesFromBody,
  parseProductAttributesBody,
  supplierProductAttributesEqual,
} from "@/lib/supplier-product-attributes"
import { parseCompareAtDraftLax, parseCompareAtStrict } from "@/lib/supplier-product-compare-at"
import { parseDescriptionBullets } from "@/lib/supplier-product-description-bullets"
import {
  parseDescriptionIllustrationImages,
  parseDescriptionIllustrationVideos,
} from "@/lib/supplier-product-description-illustrations"
import { parseChinaImportFields } from "@/lib/china-buying/china-buying-shared"
import { routeChinaBuy } from "@/lib/china-buying/route-china-buy"
import { revalidateSupplierShopfront } from "@/lib/revalidate-supplier-shopfront"
import { revalidateListingCardImagesForProduct } from "@/lib/revalidate-listing-card-image"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { parseProductMarketplaceMeta } from "@/lib/supplier-product-marketplace-meta"
import {
  parseProductOfferBody,
  resolveSupplierCatalogPriceCents,
} from "@/lib/supplier-product-offer-mode"
import { validateOfferModePublish } from "@/lib/product-offer-mode"
import { parseSupplierProductShippingBody, validateDeliveryCountriesPublish, validateWarehouseTypePublish } from "@/lib/supplier-product-shipping"
import { suggestCarrierIdsForProduct } from "@/lib/shipping/supplier-carrier-offers-shared"
import {
  resolveSupplierProductImagesForSave,
  validateSupplierProductImagesForPublish,
} from "@/lib/supplier-product-images"
import { parseListingKind } from "@/lib/supplier-commission"
import {
  parseProductDigitalDeliveryBody,
  validateDigitalDeliveryForPublish,
} from "@/lib/digital-delivery/parse-product-digital"
import { parseProductBookingBody } from "@/lib/booking/parse-product-booking"
import { countAvailableBookingSlots } from "@/lib/booking/slot-availability"
import {
  isBookableListingKind,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/types"
import { parseAffisellCommissionOverrideFromBody } from "@/lib/supplier-product-affisell-commission-override"
import {
  AFFILIATE_COMMISSION_REQUIRED_ERROR,
  validateExplicitSupplierCommissionForPublish,
} from "@/lib/supplier-explicit-commission"
import { productCommissionRateForSave } from "@/lib/supplier-product-commission-save"
import { normalizeLeafCategoryId } from "@/lib/category-leaf-guard"
import {
  parseCustomColumnsFromBody,
  parseCustomColumnsFromDb,
  validateVariantsCustomData,
} from "@/lib/product-custom-columns"
import {
  applyCustomColumnsToVariantRows,
  isSkuVariantsSyncBody,
  parseProductVariantsFromBody,
  serializeProductVariantRow,
  syncProductVariants,
} from "@/lib/product-variant-sku"
import { parseVariantsPayload } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"
import {
  captureWholesaleSnapshotFromProductRow,
  notifyAffiliatesAfterSupplierProductSave,
} from "@/lib/affiliate-wholesale-change-notify"
import { deleteSupplierProduct } from "@/lib/supplier-product-remove.server"
import { SUPPLIER_PRODUCT_REMOVE_CODE } from "@/lib/supplier-product-remove-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertOwnProduct(supplierId: string, productId: string) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const p = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    include: {
      attributes: { orderBy: { label: "asc" } },
      productVariants: { orderBy: { createdAt: "asc" } },
      category: {
        select: { id: true, name: true, fullPath: true, affisellCommissionRateBps: true },
      },
    },
  })
  if (!p) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const variants = p.productVariants.map((v) =>
    serializeProductVariantRow(v, p.commissionRate)
  )

  return Response.json({
    ...p,
    compareAt: p.compareAt != null ? Number(p.compareAt) : null,
    freeShippingThreshold: p.freeShippingThreshold != null ? Number(p.freeShippingThreshold) : null,
    shippingCost: Number(p.shippingCost),
    listingKind: parseListingKind(p.listingKind),
    hasVariants: p.hasVariants,
    listingVariants: p.variants,
    customColumns: parseCustomColumnsFromDb(p.customColumns),
    variants,
  })
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params

  const putLoad = await loadSupplierProductForPut(id, session.user.id)
  if (!putLoad) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const existingRow = putLoad.guard
  const wholesaleBeforeSnapshot = putLoad.wholesaleBeforeSnapshot
  const existingOfferRow = putLoad.offerRow

  const rawBody = (await req.json()) as Record<string, unknown>
  const publish = Boolean(rawBody.publish)
  const saveAsDraftReq = Boolean(rawBody.saveAsDraft)
  /** Ignore stale client autosaves that still send saveAsDraft after the listing went live. */
  const effectiveSaveAsDraft = saveAsDraftReq && existingRow.isDraft

  if (!existingRow.isDraft && saveAsDraftReq && !publish) {
    console.log("[supplier-products-put]", {
      productId: id,
      publish,
      saveAsDraft: saveAsDraftReq,
      result: "stale_draft_autosave_on_live",
    })
  }

  const body = rawBody as {
    name?: string
    description?: string
    image?: string
    images?: unknown
    price?: number
    compareAt?: number | string | null
    commission?: number
    stock?: number
    categoryId?: string | null
    productAttributes?: Array<{ key?: unknown; label?: unknown; value?: unknown }>
    listingKind?: unknown
  }

  const listingKind = parseListingKind(body.listingKind ?? existingRow.listingKind)
  const digitalKeysPresent =
    "digitalAccessUrl" in rawBody ||
    "digitalAccessInstructions" in rawBody ||
    "digitalInstantDelivery" in rawBody
  const digitalParsed = parseProductDigitalDeliveryBody(rawBody)
  if (!digitalParsed.ok) {
    return Response.json({ error: digitalParsed.error }, { status: 400 })
  }
  const bookingKeysPresent =
    "bookingDurationMinutes" in rawBody ||
    "bookingCancellationHours" in rawBody ||
    "bookingVenueLabel" in rawBody ||
    "bookingInstantConfirm" in rawBody ||
    "bookingSeatLayout" in rawBody
  const bookingParsed = parseProductBookingBody(rawBody)
  const isPublishing = publish || (!existingRow.isDraft && !effectiveSaveAsDraft)
  if (isPublishing) {
    const digitalForValidate = digitalKeysPresent
      ? digitalParsed.data
      : {
          digitalAccessUrl: existingOfferRow?.digitalAccessUrl ?? null,
          digitalAccessInstructions: existingOfferRow?.digitalAccessInstructions ?? null,
          digitalInstantDelivery: existingOfferRow?.digitalInstantDelivery ?? true,
        }
    const digitalErr = validateDigitalDeliveryForPublish(listingKind, digitalForValidate, false)
    if (digitalErr) {
      return Response.json({ error: digitalErr }, { status: 400 })
    }
    if (isBookableListingKind(listingKind) && isBookingCheckoutLiveForKind(listingKind)) {
      const openSlots = await countAvailableBookingSlots(id)
      if (openSlots === 0) {
        return Response.json({ error: "booking_slots_required" }, { status: 400 })
      }
    }
  }
  let priceCents: number
  let compareAt: Prisma.Decimal | null = null
  let rate = existingRow.commissionRate
  let nameResolved: string
  let stock: number
  const draftUpdateOnly = existingRow.isDraft && !publish
  const offer = parseProductOfferBody(rawBody, existingOfferRow ?? undefined)

  if (draftUpdateOnly) {
    const priceNum = Number(body.price)
    priceCents =
      Number.isFinite(priceNum) && priceNum >= 0
        ? resolveSupplierCatalogPriceCents(offer.offerMode, Math.round(priceNum * 100), true)
        : resolveSupplierCatalogPriceCents(offer.offerMode, existingRow.basePriceCents, true)

    compareAt = parseCompareAtDraftLax(priceCents, body.compareAt ?? null)

    const rawName = typeof body.name === "string" ? body.name.trim() : ""
    nameResolved = (rawName || "Untitled draft").slice(0, 500)

    stock = Math.max(
      0,
      Math.round(
        Number.isFinite(Number(body.stock)) ? Number(body.stock) : existingRow.stock
      )
    )
  } else {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return Response.json({ error: "Missing name" }, { status: 400 })
    }
    nameResolved = name.slice(0, 500)

    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return Response.json({ error: "Invalid price" }, { status: 400 })
    }
    if (price <= 0 && offer.offerMode !== "DONATION") {
      return Response.json({ error: "Invalid price" }, { status: 400 })
    }
    priceCents = resolveSupplierCatalogPriceCents(offer.offerMode, Math.round(price * 100), false)

    const strict = parseCompareAtStrict(priceCents, body.compareAt ?? null)
    if (!strict.ok) {
      return Response.json({ error: strict.error }, { status: 400 })
    }
    compareAt = strict.decimal

    stock = Math.max(
      0,
      Math.round(
        Number.isFinite(Number(body.stock)) ? Number(body.stock) : existingRow.stock
      )
    )
  }

  const activatingFromDraft = Boolean(existingRow.isDraft && publish)

  if (publish || activatingFromDraft) {
    const kycBlocked = await requireMerchantVerifiedForPublish(session.user.id)
    if (kycBlocked) return kycBlocked
  }

  if (publish || activatingFromDraft) {
    const offerErr = validateOfferModePublish(offer.offerMode, offer.minOrderQuantity)
    if (offerErr) {
      return Response.json({ error: offerErr }, { status: 400 })
    }
  }
  const desc = typeof body.description === "string" ? body.description.trim() : ""
  const descriptionBulletsPatch =
    "descriptionBullets" in rawBody
      ? parseDescriptionBullets((rawBody as Record<string, unknown>).descriptionBullets)
      : undefined
  const images = resolveSupplierProductImagesForSave(
    body as unknown as Record<string, unknown>,
    existingOfferRow?.images
  )
  const descriptionIllustrationImagesPatch =
    "descriptionIllustrationImages" in rawBody
      ? parseDescriptionIllustrationImages(rawBody)
      : undefined
  const descriptionIllustrationVideosPatch =
    "descriptionIllustrationVideos" in rawBody
      ? parseDescriptionIllustrationVideos(rawBody)
      : undefined
  const attr = parseProductAttributesBody(body as unknown as Record<string, unknown>)
  const ship = parseSupplierProductShippingBody(body as unknown as Record<string, unknown>)
  if (publish || activatingFromDraft) {
    const imagesErr = validateSupplierProductImagesForPublish(images)
    if (imagesErr) {
      return Response.json({ error: imagesErr }, { status: 400 })
    }
    const warehouseTypeForPublish =
      "warehouseType" in rawBody
        ? ship.warehouseType
        : existingOfferRow?.warehouseType ?? null
    const warehouseErr = validateWarehouseTypePublish(warehouseTypeForPublish)
    if (warehouseErr) {
      return Response.json({ error: warehouseErr }, { status: 400 })
    }
    const deliveryCodesForPublish =
      "deliveryCountryCodes" in rawBody
        ? ship.deliveryCountryCodes
        : putLoad.deliveryCountryCodes
    const deliveryErr = validateDeliveryCountriesPublish(deliveryCodesForPublish)
    if (deliveryErr) {
      return Response.json({ error: deliveryErr }, { status: 400 })
    }
  }
  const meta = parseProductMarketplaceMeta(body as unknown as Record<string, unknown>)
  const chinaImport =
    "sourceUrl" in rawBody ||
    "chinaBuyingAgentId" in rawBody ||
    "chinaPlatform" in rawBody ||
    "importSource" in rawBody
      ? parseChinaImportFields(rawBody)
      : null
  let categoryId: string | null | undefined = undefined
  if ("categoryId" in rawBody) {
    try {
      categoryId = await normalizeLeafCategoryId(body.categoryId)
    } catch (e) {
      if (e instanceof Error && e.message === "CATEGORY_NOT_FOUND") {
        return Response.json({ error: "Unknown category" }, { status: 400 })
      }
      if (e instanceof Error && e.message === "CATEGORY_NOT_LEAF") {
        return Response.json({ error: "Category must be a leaf node" }, { status: 400 })
      }
      throw e
    }
  }
  const affisellOverridePatch = parseAffisellCommissionOverrideFromBody(
    rawBody.affisellCommissionRateOverridePercent ?? rawBody.affisellCommissionRateOverrideBps
  )
  const productAttributes = normalizeProductAttributesFromBody(body.productAttributes)

  let customColumnsUpdate: CustomColumn[] | undefined
  if ("customColumns" in rawBody) {
    const parsed = parseCustomColumnsFromBody(rawBody)
    if (!Array.isArray(parsed)) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }
    customColumnsUpdate = parsed
  }

  const rawSkuVariants = Array.isArray(rawBody.variants) ? rawBody.variants : []
  const variantPatch = isSkuVariantsSyncBody(rawBody)
    ? parseProductVariantsFromBody({
        hasVariants: rawBody.hasVariants,
        variants: rawBody.variants,
      })
    : null

  if (variantPatch && "error" in variantPatch) {
    if (!draftUpdateOnly) {
      return Response.json(
        { error: variantPatch.error, issues: variantPatch.issues },
        { status: 400 }
      )
    }
    // Brouillon : on enregistre le reste même si le tableau SKU est incomplet.
  }

  if (variantPatch && !("error" in variantPatch)) {
    const cols =
      customColumnsUpdate ??
      parseCustomColumnsFromDb(putLoad.customColumns)
    const customErr = validateVariantsCustomData(cols, rawSkuVariants)
    if (customErr && !draftUpdateOnly) {
      return Response.json({ error: customErr }, { status: 400 })
    }
    if (cols.length > 0) {
      variantPatch.variants = applyCustomColumnsToVariantRows(
        variantPatch.variants,
        cols,
        rawSkuVariants
      )
    }
  }

  const hasCommissionInput = "commission" in body || "commissionRate" in rawBody
  const variantCommissionRates =
    variantPatch && !("error" in variantPatch) && variantPatch.hasVariants && variantPatch.variants.length > 0
      ? variantPatch.variants.map((v) => v.commissionRate)
      : undefined
  if (hasCommissionInput || (variantCommissionRates?.length ?? 0) > 0) {
    const commissionResolved = productCommissionRateForSave({
      topLevelRaw: hasCommissionInput ? body.commission : undefined,
      variantCommissionRates,
      listingKind,
      fallbackRate: existingRow.commissionRate,
      requireExplicit: isPublishing && !draftUpdateOnly,
      offerMode: offer.offerMode,
    })
    if (!commissionResolved.ok && !draftUpdateOnly) {
      return Response.json({ error: commissionResolved.error }, { status: 400 })
    }
    if (commissionResolved.ok) {
      rate = commissionResolved.rate
    }
  } else if (isPublishing && !draftUpdateOnly) {
    let persistedVariantRates = variantCommissionRates
    if (!persistedVariantRates?.length) {
      const parsed = parseVariantsPayload(putLoad.listingVariantsJson ?? null)
      const rows = parsed?.variantRows ?? []
      if (rows.length > 0) {
        persistedVariantRates = rows.map((row) => row.commission)
      }
    }
    const explicit = validateExplicitSupplierCommissionForPublish({
      resolvedRate: rate,
      variantCommissionRates: persistedVariantRates,
      offerMode: offer.offerMode,
    })
    if (!explicit.ok) {
      return Response.json({ error: AFFILIATE_COMMISSION_REQUIRED_ERROR }, { status: 400 })
    }
  }

  const seatLayoutChanged = "bookingSeatLayout" in rawBody

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id },
      data: {
        name: nameResolved,
        description: desc,
        ...(descriptionBulletsPatch !== undefined
          ? { descriptionBullets: descriptionBulletsPatch }
          : {}),
        ...(descriptionIllustrationImagesPatch !== undefined
          ? { descriptionIllustrationImages: descriptionIllustrationImagesPatch }
          : {}),
        ...(descriptionIllustrationVideosPatch !== undefined
          ? { descriptionIllustrationVideos: descriptionIllustrationVideosPatch }
          : {}),
        images,
        /** Only touch merchandising JSON when the client sends the key — step-1 autosaves omit these. */
        ...("colorImages" in rawBody
          ? {
              colorImages:
                attr.colorImages === null
                  ? Prisma.DbNull
                  : (attr.colorImages as unknown as Prisma.InputJsonValue),
            }
          : {}),
        ...("categories" in rawBody ? { categories: attr.categories } : {}),
        ...("colors" in rawBody ? { colors: attr.colors } : {}),
        ...("tags" in rawBody ? { tags: attr.tags } : {}),
        ...("listingVariants" in rawBody ||
        (typeof rawBody.variants === "object" &&
          rawBody.variants !== null &&
          !Array.isArray(rawBody.variants))
          ? {
              variants:
                attr.variants === null
                  ? Prisma.DbNull
                  : (attr.variants as unknown as Prisma.InputJsonValue),
            }
          : {}),
        basePriceCents: priceCents,
        compareAt,
        commissionRate: rate,
        listingKind,
        stock,
        ...("categoryId" in rawBody ? { categoryId } : {}),
        ...(affisellOverridePatch !== undefined
          ? { affisellCommissionRateOverrideBps: affisellOverridePatch }
          : {}),
        ...("shippingCountry" in rawBody ? { shippingCountry: ship.shippingCountry } : {}),
        ...("warehouseType" in rawBody ? { warehouseType: ship.warehouseType } : {}),
        ...("warehouseCity" in rawBody ? { warehouseCity: ship.warehouseCity } : {}),
        ...("deliveryCountryCodes" in rawBody
          ? { deliveryCountryCodes: ship.deliveryCountryCodes }
          : {}),
        ...("processingTime" in rawBody ? { processingTime: ship.processingTime } : {}),
        ...("deliveryMin" in rawBody ? { deliveryMin: ship.deliveryMin } : {}),
        ...("deliveryMax" in rawBody ? { deliveryMax: ship.deliveryMax } : {}),
        ...("shippingMethods" in rawBody ? { shippingMethods: ship.shippingMethods } : {}),
        ...("shippingCarrierIds" in rawBody
          ? {
              shippingCarrierIds:
                ship.shippingCarrierIds.length > 0
                  ? ship.shippingCarrierIds
                  : suggestCarrierIdsForProduct({
                      shipFromCountry: ship.shippingCountry,
                      shippingMethods: ship.shippingMethods,
                    }),
            }
          : {}),
        ...("freeShippingThresholdEUR" in rawBody || "freeShippingThreshold" in rawBody
          ? { freeShippingThreshold: ship.freeShippingThreshold }
          : {}),
        ...("shippingCostEUR" in rawBody || "shippingCost" in rawBody
          ? { shippingCost: ship.shippingCost }
          : {}),
        shipsFrom: meta.shipsFrom,
        deliveryDays: meta.deliveryDays,
        freeShipping: meta.freeShipping,
        isLuxury: meta.isLuxury,
        supplierTag: meta.supplierTag,
        offerMode: offer.offerMode,
        minOrderQuantity: offer.minOrderQuantity,
        isRefurbished: offer.isRefurbished,
        ...(digitalKeysPresent
          ? {
              digitalAccessUrl: digitalParsed.data.digitalAccessUrl,
              digitalAccessInstructions: digitalParsed.data.digitalAccessInstructions,
              digitalInstantDelivery: digitalParsed.data.digitalInstantDelivery,
            }
          : {}),
        ...(bookingKeysPresent
          ? {
              ...("bookingDurationMinutes" in rawBody
                ? { bookingDurationMinutes: bookingParsed.bookingDurationMinutes }
                : {}),
              ...("bookingCancellationHours" in rawBody
                ? { bookingCancellationHours: bookingParsed.bookingCancellationHours }
                : {}),
              ...("bookingVenueLabel" in rawBody
                ? { bookingVenueLabel: bookingParsed.bookingVenueLabel }
                : {}),
              ...("bookingInstantConfirm" in rawBody
                ? { bookingInstantConfirm: bookingParsed.bookingInstantConfirm }
                : {}),
              ...("bookingSeatLayout" in rawBody
                ? {
                    bookingSeatLayout:
                      bookingParsed.bookingSeatLayout === null ||
                      bookingParsed.bookingSeatLayout === undefined
                        ? Prisma.DbNull
                        : (bookingParsed.bookingSeatLayout as Prisma.InputJsonValue),
                  }
                : {}),
            }
          : {}),
        ...("customColumns" in rawBody
          ? {
              customColumns:
                customColumnsUpdate && customColumnsUpdate.length > 0
                  ? (customColumnsUpdate as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
        ...(chinaImport
          ? {
              ...(chinaImport.sourceUrl !== null ? { sourceUrl: chinaImport.sourceUrl } : {}),
              ...(chinaImport.chinaBuyingAgentId !== null
                ? { chinaBuyingAgentId: chinaImport.chinaBuyingAgentId }
                : {}),
              ...(chinaImport.chinaPlatform !== null
                ? { chinaPlatform: chinaImport.chinaPlatform }
                : {}),
              ...(chinaImport.importSource !== null
                ? { importSource: chinaImport.importSource }
                : {}),
            }
          : {}),
      },
    })

    const shouldSyncProductAttributes =
      "productAttributes" in rawBody &&
      !supplierProductAttributesEqual(putLoad.attributes, productAttributes)

    if (shouldSyncProductAttributes) {
      await tx.productAttribute.deleteMany({ where: { productId: id } })
      if (productAttributes.length) {
        await tx.productAttribute.createMany({
          data: productAttributes.map((a) => ({
            productId: id,
            key: a.key,
            label: a.label || a.key,
            value: a.value,
          })),
        })
      }
    }

    if (variantPatch && !("error" in variantPatch)) {
      await syncProductVariants(tx, id, variantPatch.hasVariants, variantPatch.variants)
    }

    await applySupplierProductVisibilityFlags(tx, id, {
      publish,
      saveAsDraft: effectiveSaveAsDraft,
    })

    const freshRow = await tx.product.findUnique({ where: { id } })
    return freshRow ?? p
  }, SUPPLIER_PRODUCT_WRITE_TX)
  } catch (e) {
    const message = e instanceof Error ? e.message : "product_update_failed"
    console.error("[supplier-products-put]", { id, message, stack: e instanceof Error ? e.stack?.slice(0, 800) : undefined })
    const timedOut = /timed out|timeout|P2028/i.test(message)
    return Response.json(
      {
        error: timedOut
          ? "Enregistrement impossible (délai dépassé ou données trop lourdes). Réessayez."
          : message.slice(0, 240) || "Enregistrement impossible. Réessayez.",
      },
      { status: 500 }
    )
  }

  if (
    chinaImport?.sourceUrl &&
    chinaImport.chinaBuyingAgentId
  ) {
    void routeChinaBuy({
      supplierId: session.user.id,
      sourceUrl: chinaImport.sourceUrl,
      agentId: chinaImport.chinaBuyingAgentId,
      platform: chinaImport.chinaPlatform,
      productId: id,
    })
  }

  if (publish && !isSupplierProductResellerVisible(updated)) {
    console.error("[supplier-products-put]", {
      productId: id,
      publish,
      saveAsDraft: saveAsDraftReq,
      resultActive: updated.active,
      resultIsDraft: updated.isDraft,
      result: "publish_incomplete",
    })
    return Response.json(
      { error: "Publication incomplete — le produit est resté en brouillon. Réessayez." },
      { status: 409 }
    )
  }

  console.log("[supplier-products-put]", {
    productId: id,
    publish,
    saveAsDraft: saveAsDraftReq,
    resultActive: updated.active,
    resultIsDraft: updated.isDraft,
    resellerVisible: isSupplierProductResellerVisible(updated),
  })

  const variantsChanged = Boolean(variantPatch && !("error" in variantPatch))
  const fresh = variantsChanged
    ? await prisma.product.findUnique({
        where: { id },
        include: { productVariants: { orderBy: { createdAt: "asc" } } },
      })
    : null

  const wasPublishedLive = publish && isSupplierProductResellerVisible(updated)

  if (wasPublishedLive) {
    const supplierStore = await prisma.store.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (supplierStore) {
      void createNewDropCommunityPost({
        storeId: supplierStore.id,
        productId: updated.id,
        productName: updated.name,
      }).catch((e) =>
        console.error("[supplier-products] community new-drop post failed", {
          productId: updated.id,
          error: e instanceof Error ? e.message : String(e),
        })
      )
    }
    const publishRow = fresh ?? updated
    void onSupplierProductPublishedFromInvite({
      supplierId: session.user.id,
      productId: publishRow.id,
      productName: publishRow.name,
      commissionRate: publishRow.commissionRate,
      variants: publishRow.variants,
      basePriceCents: publishRow.basePriceCents,
      images: publishRow.images,
    }).catch((e) => console.error("[supplier-invite] publish hook", e))
  }

  if (seatLayoutChanged && listingKind === "EXPERIENCE") {
    const { syncProductSeatLayoutForFutureSlots } = await import("@/lib/booking/sync-seat-layout")
    void syncProductSeatLayoutForFutureSlots(id).catch((e) => {
      console.error("[booking]", {
        productId: id,
        result: "seat_layout_sync_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  const isLiveAfterSave = !updated.isDraft && updated.active
  if (isLiveAfterSave && wholesaleBeforeSnapshot) {
    void notifyAffiliatesAfterSupplierProductSave({
      productId: id,
      before: wholesaleBeforeSnapshot,
    }).catch((e) => {
      console.error("[wholesale-change-guard]", {
        productId: id,
        result: "notify_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  const isLive = !updated.isDraft && updated.active
  const savedCategoryId = categoryId ?? updated.categoryId
  if (isLive && !savedCategoryId) {
    scheduleProductAutoCategorization(updated.id)
  } else if (
    updated.isDraft &&
    !publish &&
    !savedCategoryId &&
    nameResolved.trim().length >= 5
  ) {
    scheduleProductAutoCategorization(updated.id, { allowDraft: true })
  }

  const shouldRevalidateShopfront =
    publish || activatingFromDraft || (!updated.isDraft && updated.active)
  if (shouldRevalidateShopfront) {
    void revalidateSupplierShopfront(session.user.id)
  }
  if (
    shouldRevalidateShopfront &&
    ("images" in rawBody || "image" in rawBody || "colorImages" in rawBody)
  ) {
    void revalidateListingCardImagesForProduct(id)
  }

  return Response.json({
    ...(fresh ?? updated),
    variants: (fresh?.productVariants ?? putLoad.productVariants).map((v) =>
      serializeProductVariantRow(v, fresh?.commissionRate ?? updated.commissionRate)
    ),
  })
}

/** Partial update: SKU table + simple price/stock (avoids wiping listing fields). */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const rawBody = (await req.json()) as Record<string, unknown>
  const variantPatch = parseProductVariantsFromBody({
    hasVariants: rawBody.hasVariants,
    variants: rawBody.variants,
  })
  if ("error" in variantPatch) {
    return Response.json(
      { error: variantPatch.error, issues: variantPatch.issues },
      { status: 400 }
    )
  }

  const existingRow = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: {
      basePriceCents: true,
      variants: true,
      listingKind: true,
      commissionRate: true,
      colors: true,
      hasVariants: true,
      isDraft: true,
      active: true,
      productVariants: {
        select: {
          color: true,
          size: true,
          stock: true,
          supplierPrice: true,
          wholesalePriceCents: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!existingRow) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const wholesaleBeforeSnapshot = captureWholesaleSnapshotFromProductRow(existingRow)

  const commRaw = rawBody.commission ?? rawBody.commissionRate
  const listingKind = parseListingKind(rawBody.listingKind ?? existingRow.listingKind)
  const hasCommissionInput = commRaw != null && Number.isFinite(Number(commRaw))
  const variantCommissionRates =
    variantPatch.hasVariants && variantPatch.variants.length > 0
      ? variantPatch.variants.map((v) => v.commissionRate)
      : undefined
  let commissionUpdate: number | undefined
  if (hasCommissionInput || (variantCommissionRates?.length ?? 0) > 0) {
    const commissionResolved = productCommissionRateForSave({
      topLevelRaw: hasCommissionInput ? Number(commRaw) : undefined,
      variantCommissionRates,
      listingKind,
      fallbackRate: existingRow.commissionRate,
    })
    if (!commissionResolved.ok) {
      return Response.json({ error: commissionResolved.error }, { status: 400 })
    }
    commissionUpdate = commissionResolved.rate
  }

  let priceCentsForCompare = existingRow.basePriceCents
  if (!variantPatch.hasVariants) {
    const price = Number(rawBody.price)
    if (Number.isFinite(price) && price > 0) {
      priceCentsForCompare = Math.max(100, Math.round(price * 100))
    }
  } else if (variantPatch.variants.length > 0) {
    const minSupplier = Math.min(...variantPatch.variants.map((v) => v.supplierPrice))
    if (Number.isFinite(minSupplier) && minSupplier > 0) {
      priceCentsForCompare = Math.max(100, Math.round(minSupplier * 100))
    }
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.ProductUpdateInput = {}
    if (typeof rawBody.name === "string" && rawBody.name.trim()) {
      data.name = rawBody.name.trim().slice(0, 500)
    }
    if (commissionUpdate != null) {
      data.commissionRate = commissionUpdate
    }
    if ("compareAt" in rawBody) {
      data.compareAt = parseCompareAtDraftLax(priceCentsForCompare, rawBody.compareAt ?? null)
    }
    if (
      rawBody.listingVariants &&
      typeof rawBody.listingVariants === "object" &&
      !Array.isArray(rawBody.listingVariants)
    ) {
      const existingVariants = parseVariantsPayload(existingRow.variants) ?? {}
      const incoming = rawBody.listingVariants as Record<string, unknown>
      data.variants = {
        ...existingVariants,
        ...incoming,
        variantRows:
          incoming.variantRows ?? existingVariants.variantRows,
      } as unknown as Prisma.InputJsonValue
    }
    if (!variantPatch.hasVariants) {
      const price = Number(rawBody.price)
      if (Number.isFinite(price) && price > 0) {
        data.basePriceCents = Math.max(100, Math.round(price * 100))
      }
      const stock = Number(rawBody.stock)
      if (Number.isFinite(stock)) {
        data.stock = Math.max(0, Math.round(stock))
      }
    } else if (variantPatch.variants.length > 0) {
      data.basePriceCents = priceCentsForCompare
      data.stock = variantPatch.variants.reduce((acc, v) => acc + Math.max(0, v.stock), 0)
    }
    if (Object.keys(data).length) {
      await tx.product.update({ where: { id }, data })
    }
    await syncProductVariants(tx, id, variantPatch.hasVariants, variantPatch.variants)
  }, SUPPLIER_PRODUCT_WRITE_TX)

  const fresh = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    include: { productVariants: { orderBy: { createdAt: "asc" } } },
  })
  if (!fresh) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const isLiveAfterPatch = !fresh.isDraft && fresh.active
  if (isLiveAfterPatch) {
    void notifyAffiliatesAfterSupplierProductSave({
      productId: id,
      before: wholesaleBeforeSnapshot,
    }).catch((e) => {
      console.error("[wholesale-change-guard]", {
        productId: id,
        result: "notify_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  void revalidateSupplierShopfront(session.user.id)
  if ("images" in rawBody || "image" in rawBody || "colorImages" in rawBody) {
    void revalidateListingCardImagesForProduct(id)
  }

  return Response.json({
    ...fresh,
    compareAt: fresh.compareAt != null ? Number(fresh.compareAt) : null,
    shippingCost: Number(fresh.shippingCost),
    variants: fresh.productVariants.map((v) =>
      serializeProductVariantRow(v, fresh.commissionRate)
    ),
  })
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const result = await deleteSupplierProduct(session.user.id, id)

  if (!result.ok) {
    const status =
      result.code === SUPPLIER_PRODUCT_REMOVE_CODE.NOT_FOUND
        ? 404
        : result.code === SUPPLIER_PRODUCT_REMOVE_CODE.REQUIRES_RECALL
          ? 409
          : 409
    return Response.json(
      {
        error: result.message,
        code: result.code,
        ...(result.listedAffiliateCount != null
          ? { listedAffiliateCount: result.listedAffiliateCount }
          : {}),
      },
      { status }
    )
  }

  return new Response(null, { status: 204 })
}
