import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import {
  previewResellerUrlImport,
  resellerImportPreviewJson,
  type ResellerImportPreview,
} from "@/lib/affiliate-url-import.server"
import {
  DROPFORGE_MAX_IMAGES,
  buildDropForgeProductPersistFields,
  dropForgeIncompleteError,
  isDropForgeImportComplete,
} from "@/lib/dropforge-complete-import"
import {
  ensureDropForgeSupplierLink,
  resolveDropForgeFulfillmentMeta,
  withDropForgeFulfillment,
  catalogProductHasActiveSupplierLink,
} from "@/lib/dropforge-fulfillment"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { syncProductVariants } from "@/lib/product-variant-sku"
import { prisma } from "@/lib/prisma"

/** Supplier DropForge catalog rows (B2B sourcing → resellers relist). */
export const SUPPLIER_DROPFORGE_IMPORT_SOURCE = "dropforge_supplier"

export { resellerImportPreviewJson }

async function enrichSupplierDropForgePreview(
  preview: ResellerImportPreview
): Promise<ResellerImportPreview> {
  const hasLink = preview.catalogProductId
    ? await catalogProductHasActiveSupplierLink(preview.catalogProductId)
    : false
  const enriched = withDropForgeFulfillment(
    preview,
    resolveDropForgeFulfillmentMeta({
      sourceUrl: preview.sourceUrl,
      catalogProductId: preview.catalogProductId,
      catalogHasSupplierLink: hasLink,
      supplierCatalog: true,
    })
  )
  enriched.warnings = enriched.warnings.filter(
    (w) => !/publication live bloquée|sans SupplierLink/i.test(w)
  )
  return enriched
}

export async function previewDropForgeImport(
  rawUrl: string
): Promise<
  | { ok: true; preview: ResellerImportPreview }
  | { ok: false; error: string; status: number; marketplaceLabel?: string }
> {
  const result = await previewResellerUrlImport(rawUrl)
  if (!result.ok) return result
  const preview = await enrichSupplierDropForgePreview(result.preview)
  return { ok: true, preview }
}

function sanitizeSupplierSnapshot(
  raw: unknown,
  sourceUrl: string
): ResellerImportPreview | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const snapUrl = typeof o.sourceUrl === "string" ? o.sourceUrl.trim() : ""
  if (snapUrl !== sourceUrl) return null
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : ""
  if (title.length < 2) return null
  const costPrice =
    typeof o.costPrice === "number" && Number.isFinite(o.costPrice)
      ? Math.max(0.01, o.costPrice)
      : null
  if (costPrice == null) return null
  const suggestedPrice =
    typeof o.suggestedPrice === "number" && Number.isFinite(o.suggestedPrice)
      ? Math.max(costPrice + 0.01, o.suggestedPrice)
      : Math.max(costPrice * 1.25, costPrice + 0.5)
  const images = Array.isArray(o.images)
    ? o.images
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
        .slice(0, DROPFORGE_MAX_IMAGES)
    : []
  if (!isDropForgeImportComplete({ title, description: title, images, costPrice })) {
    return null
  }

  const preview = {
    ...(o as unknown as ResellerImportPreview),
    title,
    costPrice,
    suggestedPrice,
    profitPerSale: Math.max(0, Number((suggestedPrice - costPrice).toFixed(2))),
    sourceUrl,
    images,
  } as ResellerImportPreview

  const meta = resolveDropForgeFulfillmentMeta({
    sourceUrl,
    catalogProductId:
      typeof o.catalogProductId === "string" ? o.catalogProductId : undefined,
    catalogHasSupplierLink: o.fulfillmentReason === "catalog_link",
    supplierCatalog: true,
  })
  return withDropForgeFulfillment(preview, meta)
}

/**
 * Commit DropForge scrape into the signed-in supplier's Affisell catalog.
 * Resellers discover & relist — no AffiliateProduct created here.
 */
export async function commitSupplierDropForgeImport(args: {
  supplierId: string
  supplierEmail: string
  supplierName?: string | null
  sourceUrl: string
  /** Wholesale price for resellers (EUR). */
  wholesalePriceEur?: number
  titleOverride?: string
  publishLive?: boolean
  snapshot?: unknown
}): Promise<
  | {
      ok: true
      productId: string
      storeSlug: string
      editHref: string
      catalogHref: string
      isPublished: boolean
      fulfillmentReady: boolean
    }
  | { ok: false; error: string; status: number }
> {
  const validated = validateDropForgeProductUrl(args.sourceUrl)
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 }
  }
  const sourceUrl = validated.url

  let preview: ResellerImportPreview
  const fromSnapshot = sanitizeSupplierSnapshot(args.snapshot, sourceUrl)
  if (fromSnapshot) {
    preview = fromSnapshot
    if (args.titleOverride?.trim()) {
      preview = { ...preview, title: args.titleOverride.trim().slice(0, 200) }
    }
  } else {
    const previewRes = await previewResellerUrlImport(sourceUrl)
    if (!previewRes.ok) {
      return { ok: false, error: previewRes.error, status: previewRes.status }
    }
    preview = previewRes.preview
    if (args.titleOverride?.trim()) {
      preview = { ...preview, title: args.titleOverride.trim().slice(0, 200) }
    }
  }

  if (!isDropForgeImportComplete(preview)) {
    return {
      ok: false,
      error: dropForgeIncompleteError(preview.marketplaceLabel),
      status: 422,
    }
  }

  const hasLink = preview.catalogProductId
    ? await catalogProductHasActiveSupplierLink(preview.catalogProductId)
    : false
  const fulfillment = resolveDropForgeFulfillmentMeta({
    sourceUrl: preview.sourceUrl,
    catalogProductId: preview.catalogProductId,
    catalogHasSupplierLink: hasLink,
    supplierCatalog: true,
  })
  preview = withDropForgeFulfillment(preview, fulfillment)
  const fulfillmentReady = preview.fulfillmentReady === true

  await ensureMerchantStore({
    userId: args.supplierId,
    email: args.supplierEmail,
    displayName: args.supplierName,
  })

  const persist = buildDropForgeProductPersistFields(preview)
  const costCents = persist.basePriceCents

  // Wholesale for resellers — defaults to ~25% over source cost (B2B, not consumer ×2.8).
  const defaultWholesaleEur = Math.max(
    costCents / 100 + 0.5,
    Number((costCents / 100 * 1.25).toFixed(2))
  )
  const wholesaleEur =
    typeof args.wholesalePriceEur === "number" && Number.isFinite(args.wholesalePriceEur)
      ? args.wholesalePriceEur
      : defaultWholesaleEur
  const wholesaleCents = Math.max(costCents, Math.round(wholesaleEur * 100))

  let publishLive = args.publishLive === true
  if (publishLive && !fulfillmentReady) {
    publishLive = false
    console.log("[supplier-dropforge]", {
      supplierId: args.supplierId,
      result: "forced_draft_no_fulfillment",
      reason: preview.fulfillmentReason ?? "pending_ops",
    })
  }
  if (publishLive) {
    const gate = await merchantVerificationGate(args.supplierId)
    if (!gate.allowed) {
      publishLive = false
      console.log("[supplier-dropforge]", {
        supplierId: args.supplierId,
        result: "forced_draft_kyc",
        status: gate.status,
        reason: gate.reason,
      })
    }
  }

  const aeId =
    preview.aliexpressProductId?.trim() ||
    parseAliExpressProductId(preview.sourceUrl) ||
    null

  const existingProduct = await prisma.product.findFirst({
    where: {
      supplierId: args.supplierId,
      OR: [
        { sourceUrl: preview.sourceUrl, importSource: SUPPLIER_DROPFORGE_IMPORT_SOURCE },
        ...(aeId ? [{ aliexpressProductId: aeId }] : []),
      ],
    },
    select: { id: true },
  })

  const productData = {
    name: persist.name,
    description: persist.description,
    descriptionBullets: persist.descriptionBullets,
    descriptionIllustrationVideos: persist.descriptionIllustrationVideos,
    images: persist.images,
    colors: persist.colors,
    ...(persist.colorImages != null ? { colorImages: persist.colorImages } : {}),
    ...(persist.variants != null ? { variants: persist.variants } : {}),
    categories: preview.category ? [preview.category] : [],
    tags: [...persist.tags, "dropforge", "b2b-sourcing"].slice(0, 24),
    basePriceCents: wholesaleCents,
    supplierWholesaleCents: wholesaleCents,
    ...(costCents > 0 && preview.sku
      ? { supplierSku: preview.sku.slice(0, 64) }
      : {}),
    ...(persist.compareAt ? { compareAt: persist.compareAt } : {}),
    commissionRate: 15,
    stock: persist.stock,
    sourceUrl: preview.sourceUrl,
    importSource: aeId ? "aliexpress" : SUPPLIER_DROPFORGE_IMPORT_SOURCE,
    supplierTag: "dropforge",
    shippingCountry: persist.shippingCountry,
    warehouseType: persist.warehouseType,
    deliveryMin: persist.deliveryMin,
    deliveryMax: persist.deliveryMax,
    shippingCost: persist.shippingCost,
    shipsFrom: persist.shipsFrom,
    hasVariants: persist.variantInputs.length > 0,
    ...(aeId
      ? {
          aliexpressProductId: aeId,
          autoFulfill: true,
          autoBuyEnabled: true,
        }
      : { fulfillmentChannel: "MANUAL" as const }),
    active: publishLive,
    isDraft: !publishLive,
  }

  const product = existingProduct
    ? await prisma.product.update({
        where: { id: existingProduct.id },
        data: productData,
        select: { id: true },
      })
    : await prisma.product.create({
        data: {
          supplierId: args.supplierId,
          ...productData,
        },
        select: { id: true },
      })

  if (persist.attributes.length > 0) {
    for (const attr of persist.attributes) {
      await prisma.productAttribute.upsert({
        where: {
          productId_key: { productId: product.id, key: attr.key },
        },
        create: {
          productId: product.id,
          key: attr.key,
          value: attr.value,
          label: attr.label,
        },
        update: {
          value: attr.value,
          label: attr.label,
        },
      })
    }
  }

  if (persist.variantInputs.length > 0) {
    await prisma.$transaction(async (tx) => {
      await syncProductVariants(tx, product.id, true, persist.variantInputs)
    })
  }

  if (aeId) {
    await ensureDropForgeSupplierLink({
      productId: product.id,
      sourceUrl: preview.sourceUrl,
      aeProductId: aeId,
      aePriceCents: costCents,
    })
  }

  const store = await prisma.store.findUnique({
    where: { userId: args.supplierId },
    select: { slug: true },
  })

  console.log("[supplier-dropforge]", {
    supplierId: args.supplierId,
    productId: product.id,
    method: preview.method,
    isPublished: publishLive,
    fulfillmentReady,
    supplierLink: Boolean(aeId),
    wholesaleCents,
    costCents,
    result: "committed",
  })

  return {
    ok: true,
    productId: product.id,
    storeSlug: store?.slug ?? "",
    editHref: `/dashboard/supplier/products/${product.id}`,
    catalogHref: `/dashboard/supplier/products`,
    isPublished: publishLive,
    fulfillmentReady,
  }
}
