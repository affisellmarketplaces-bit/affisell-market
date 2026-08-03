import "server-only"

import type { Prisma } from "@prisma/client"

import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import {
  AFFISELL_AUTOBUY_IMPORT_SOURCE,
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  ensureAffisellAutoBuySupplier,
} from "@/lib/auto-buy-platform-supplier"
import { replaceSupplierLinkVariants } from "@/lib/admin/products/upsert-supplier-link-variants"
import type { AdminVariantMappingInput } from "@/lib/admin/products/supplier-link-variant-types"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import {
  parseAeProductSpecsFromPayload,
  specsToDescriptionBullets,
  type AeProductSpecRow,
} from "@/lib/fulfillment/ae-product-specs"
import { aeSkusToVariantPersist } from "@/lib/fulfillment/ae-skus-to-product-variants"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"
import {
  AliExpressClient,
  createAliExpressClient,
} from "@/lib/aliexpress-open-api"
import { syncProductVariants } from "@/lib/product-variant-sku"
import { generateAffisellSku } from "@/lib/sku/generate"
import { prisma } from "@/lib/prisma"

/** Legacy Import Vault — may still own AE drafts; safe to reassign to AutoBuy. */
const LEGACY_PLATFORM_SUPPLIER_EMAILS = [
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  "import-vault@affisell.internal",
] as const

export type EnlistAeProductInput = {
  aeUrl: string
  /** Optional display name override */
  name?: string | null
  /**
   * Optional supplier override.
   * Default: Affisell AutoBuy platform catalog (reseller-ready).
   */
  supplierId?: string | null
  /** Override wholesale HT cents; otherwise resolved AE price */
  wholesalePriceCents?: number | null
  autoBuyEnabled?: boolean
  /**
   * When true, product is published (active, not draft) → visible to resellers.
   * Default true for Instant Enlist / platform AutoBuy catalog.
   * Pass false to keep draft while finishing SKU mapping.
   */
  publish?: boolean
}

export type EnlistAeProductResult = {
  ok: true
  productId: string
  created: boolean
  aeProductId: string
  aeSkuId: string | null
  aePriceCents: number
  name: string
  autoBuyEnabled: boolean
  published: boolean
  supplierId: string
  source: string
  hasVariants: boolean
  variantCount: number
  specCount: number
}

export type EnlistAeProductError = {
  ok: false
  error: string
}

async function resolveProductCatalogMeta(
  aeProductId: string,
  fallback: string
): Promise<{
  name: string
  images: string[]
  description: string
  specs: AeProductSpecRow[]
}> {
  if (!AliExpressClient.isConfigured()) {
    return {
      name: fallback,
      images: [],
      description: `Auto-buy AE ${aeProductId}`,
      specs: [],
    }
  }
  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(aeProductId)
    const mapped = mapAliExpressGetProductResponse(raw, aeProductId)
    const specs = parseAeProductSpecsFromPayload(raw)
    return {
      name: mapped.name?.trim() || fallback,
      images: mapped.images.slice(0, 12),
      description: mapped.description?.trim() || `Auto-buy AE — ${mapped.name || aeProductId}`,
      specs,
    }
  } catch {
    return {
      name: fallback,
      images: [],
      description: `Auto-buy AE ${aeProductId}`,
      specs: [],
    }
  }
}

async function writeProductAttributes(
  productId: string,
  specs: AeProductSpecRow[]
): Promise<void> {
  if (specs.length === 0) return
  await prisma.productAttribute.deleteMany({ where: { productId } })
  await prisma.productAttribute.createMany({
    data: specs.slice(0, 40).map((s) => ({
      productId,
      key: s.key.slice(0, 64),
      value: s.value.slice(0, 500),
      label: s.label.slice(0, 80),
    })),
    skipDuplicates: true,
  })
}

async function syncEnlistVariants(opts: {
  productId: string
  supplierLinkId: string
  aeSkus: AeProductSkuRow[]
  aeShippingCents: number
  /** When true, overwrite existing ProductVariant matrix (platform Instant Enlist). */
  force: boolean
}): Promise<{ hasVariants: boolean; variantCount: number }> {
  const persist = aeSkusToVariantPersist(opts.aeSkus)
  if (!persist.hasVariants || persist.variantInputs.length === 0) {
    return { hasVariants: false, variantCount: 0 }
  }

  if (!opts.force) {
    const existingCount = await prisma.productVariant.count({
      where: { productId: opts.productId },
    })
    if (existingCount > 0) {
      return { hasVariants: true, variantCount: existingCount }
    }
  }

  await prisma.$transaction(async (tx) => {
    await syncProductVariants(tx, opts.productId, true, persist.variantInputs)
    await tx.product.update({
      where: { id: opts.productId },
      data: {
        hasVariants: true,
        colors: persist.colors,
        colorImages: persist.colorImages as Prisma.InputJsonValue,
        supplierSku: persist.defaultAeSkuId,
        ...(persist.minPriceCents > 0
          ? {
              supplierWholesaleCents: persist.minPriceCents,
              basePriceCents: Math.max(
                persist.minPriceCents,
                Math.round(persist.minPriceCents * 1.35)
              ),
            }
          : {}),
        ...(persist.totalStock > 0 ? { stock: persist.totalStock } : {}),
      },
    })
  })

  const pvs = await prisma.productVariant.findMany({
    where: { productId: opts.productId },
    select: { id: true, color: true, size: true, sku: true },
  })

  const mappings: AdminVariantMappingInput[] = opts.aeSkus
    .filter((s) => s.aeSkuId.trim())
    .map((s) => {
      const bySku = pvs.find((p) => p.sku === s.aeSkuId)
      const byColor =
        !bySku && s.matchColor
          ? pvs.find(
              (p) =>
                p.color != null &&
                canonicalVariantColorKey(p.color) === s.matchColor &&
                (s.matchSize == null ||
                  s.matchSize === "" ||
                  (p.size ?? "") === s.matchSize)
            )
          : undefined
      const pv = bySku ?? byColor
      return {
        productVariantId: pv?.id ?? null,
        matchColor: s.matchColor,
        matchSize: s.matchSize,
        aeSkuId: s.aeSkuId,
        aePriceCents: s.aePriceCents > 0 ? s.aePriceCents : 100,
        aeShippingCents: opts.aeShippingCents,
        aeLabel: s.aeLabel,
      }
    })

  await replaceSupplierLinkVariants(prisma, opts.supplierLinkId, mappings)

  console.log("[admin-enlist-ae]", {
    result: "variants_synced",
    productId: opts.productId,
    variantCount: persist.variantInputs.length,
    mappingCount: mappings.length,
  })

  return { hasVariants: true, variantCount: persist.variantInputs.length }
}

/**
 * Instant Enlist: AliExpress URL → Product + SupplierLink under Affisell AutoBuy
 * (or an explicit supplier), with full SKU matrix when AE exposes multiple variants.
 * Idempotent on `aliexpressProductId`.
 */
export async function enlistAeProductForAutoBuy(
  input: EnlistAeProductInput
): Promise<EnlistAeProductResult | EnlistAeProductError> {
  const aeUrlRaw = input.aeUrl.trim()
  const aeProductId = parseAliExpressProductId(aeUrlRaw)
  if (!aeProductId) {
    return { ok: false, error: "invalid_aliexpress_url" }
  }

  let resolved
  try {
    resolved = await resolveSupplierLinkFromAeInput(aeUrlRaw)
  } catch (e) {
    const message = e instanceof Error ? e.message : "resolve_failed"
    console.log("[admin-enlist-ae]", { result: "resolve_error", aeProductId, message })
    return { ok: false, error: message }
  }

  const aeSkus = (resolved.aeSkus ?? []).filter((s) => s.aeSkuId.trim())
  const variantPersist = aeSkusToVariantPersist(aeSkus)

  const wholesaleFromAe =
    variantPersist.minPriceCents > 0
      ? variantPersist.minPriceCents
      : Math.max(1, resolved.aePriceCents || 1)

  const wholesale =
    input.wholesalePriceCents != null &&
    Number.isFinite(input.wholesalePriceCents) &&
    input.wholesalePriceCents > 0
      ? Math.floor(input.wholesalePriceCents)
      : wholesaleFromAe

  const defaultAeSkuId = variantPersist.defaultAeSkuId ?? resolved.aeSkuId
  const autoBuyEnabled = input.autoBuyEnabled !== false
  const publish = input.publish !== false
  const explicitSupplierId = input.supplierId?.trim() || ""

  let supplierId = explicitSupplierId
  let usedPlatformAutoBuy = false
  if (supplierId) {
    const supplier = await prisma.user.findFirst({
      where: { id: supplierId, role: "SUPPLIER" },
      select: { id: true },
    })
    if (!supplier) return { ok: false, error: "supplier_not_found" }
  } else {
    const platform = await ensureAffisellAutoBuySupplier()
    supplierId = platform.id
    usedPlatformAutoBuy = true
  }

  const platformOwnerIds = new Set<string>([supplierId])
  if (usedPlatformAutoBuy) {
    const platformUsers = await prisma.user.findMany({
      where: { email: { in: [...LEGACY_PLATFORM_SUPPLIER_EMAILS] } },
      select: { id: true },
    })
    for (const u of platformUsers) platformOwnerIds.add(u.id)
  }

  const existing = await prisma.product.findFirst({
    where: { aliexpressProductId: aeProductId },
    select: {
      id: true,
      name: true,
      supplierId: true,
      importSource: true,
      supplierLink: { select: { id: true } },
      _count: { select: { productVariants: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const fallbackName = `AE ${aeProductId}`
  const meta = await resolveProductCatalogMeta(
    aeProductId,
    input.name?.trim() || existing?.name || fallbackName
  )
  const name = input.name?.trim() || meta.name || existing?.name || fallbackName
  const specBullets = specsToDescriptionBullets(meta.specs)
  const descriptionBullets =
    specBullets.length > 0 ? specBullets : variantPersist.variantBullets

  if (existing) {
    const link = await prisma.supplierLink.upsert({
      where: { productId: existing.id },
      create: {
        productId: existing.id,
        aeUrl: resolved.aeUrl,
        aeProductId,
        aeSkuId: defaultAeSkuId,
        aeShopId: resolved.aeShopId || "",
        aePriceCents: wholesale,
        aeShippingCents: resolved.aeShippingCents,
        autoBuyEnabled,
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: {
        aeUrl: resolved.aeUrl,
        aeProductId,
        aeSkuId: defaultAeSkuId ?? undefined,
        aeShopId: resolved.aeShopId || undefined,
        aePriceCents: wholesale,
        aeShippingCents: resolved.aeShippingCents,
        autoBuyEnabled,
        isActive: true,
        lastSyncAt: new Date(),
      },
    })

    const canReassignToPlatform =
      usedPlatformAutoBuy &&
      (platformOwnerIds.has(existing.supplierId) ||
        existing.importSource === AFFISELL_AUTOBUY_IMPORT_SOURCE)

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        autoBuyEnabled,
        autoFulfill: autoBuyEnabled,
        supplierSku: defaultAeSkuId,
        supplierWholesaleCents: wholesale,
        sourceUrl: resolved.aeUrl,
        description: meta.description || undefined,
        ...(meta.images.length > 0 ? { images: meta.images } : {}),
        ...(descriptionBullets.length > 0 ? { descriptionBullets } : {}),
        ...(publish ? { active: true, isDraft: false } : {}),
        ...(canReassignToPlatform ? { supplierId } : {}),
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
    })

    if (meta.specs.length > 0 && (canReassignToPlatform || existing._count.productVariants === 0)) {
      await writeProductAttributes(existing.id, meta.specs)
    }

    const forceVariants =
      canReassignToPlatform ||
      existing.importSource === AFFISELL_AUTOBUY_IMPORT_SOURCE ||
      existing._count.productVariants === 0

    const synced = await syncEnlistVariants({
      productId: existing.id,
      supplierLinkId: link.id,
      aeSkus,
      aeShippingCents: resolved.aeShippingCents,
      force: forceVariants,
    })

    console.log("[admin-enlist-ae]", {
      result: "reused",
      productId: existing.id,
      aeProductId,
      supplierId: canReassignToPlatform ? supplierId : existing.supplierId,
      published: publish,
      source: resolved.source,
      variantCount: synced.variantCount,
      specCount: meta.specs.length,
    })

    return {
      ok: true,
      productId: existing.id,
      created: false,
      aeProductId,
      aeSkuId: defaultAeSkuId,
      aePriceCents: wholesale,
      name,
      autoBuyEnabled,
      published: publish,
      supplierId: canReassignToPlatform ? supplierId : existing.supplierId,
      source: resolved.source ?? "unknown",
      hasVariants: synced.hasVariants,
      variantCount: synced.variantCount,
      specCount: meta.specs.length,
    }
  }

  const affisellSku = await generateAffisellSku()
  const basePriceCents = Math.max(wholesale, Math.round(wholesale * 1.35))
  const stock =
    variantPersist.totalStock > 0
      ? variantPersist.totalStock
      : variantPersist.hasVariants
        ? 0
        : 999

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        supplierId,
        name,
        description: meta.description,
        descriptionBullets,
        images: meta.images,
        categories: ["Auto-buy"],
        tags: usedPlatformAutoBuy ? ["affisell-autobuy"] : [],
        colors: variantPersist.colors,
        colorImages:
          variantPersist.colorImages.length > 0
            ? (variantPersist.colorImages as Prisma.InputJsonValue)
            : undefined,
        basePriceCents,
        commissionRate: 10,
        stock,
        active: publish,
        isDraft: !publish,
        importSource: AFFISELL_AUTOBUY_IMPORT_SOURCE,
        sourceUrl: resolved.aeUrl,
        aliexpressProductId: aeProductId,
        affisellSku,
        autoBuyEnabled,
        autoFulfill: autoBuyEnabled,
        supplierSku: defaultAeSkuId,
        supplierWholesaleCents: wholesale,
        hasVariants: false,
      },
    })

    const link = await tx.supplierLink.create({
      data: {
        productId: product.id,
        aeUrl: resolved.aeUrl,
        aeProductId,
        aeSkuId: defaultAeSkuId,
        aeShopId: resolved.aeShopId || "",
        aePriceCents: wholesale,
        aeShippingCents: resolved.aeShippingCents,
        autoBuyEnabled,
        isActive: true,
        lastSyncAt: new Date(),
      },
    })

    if (variantPersist.hasVariants) {
      await syncProductVariants(tx, product.id, true, variantPersist.variantInputs)
    }

    return { product, linkId: link.id }
  })

  if (meta.specs.length > 0) {
    await writeProductAttributes(created.product.id, meta.specs)
  }

  let variantCount = 0
  let hasVariants = false
  if (variantPersist.hasVariants) {
    const pvs = await prisma.productVariant.findMany({
      where: { productId: created.product.id },
      select: { id: true, color: true, size: true, sku: true },
    })
    const mappings: AdminVariantMappingInput[] = aeSkus.map((s) => {
      const bySku = pvs.find((p) => p.sku === s.aeSkuId)
      const byColor =
        !bySku && s.matchColor
          ? pvs.find(
              (p) =>
                p.color != null &&
                canonicalVariantColorKey(p.color) === s.matchColor &&
                (s.matchSize == null ||
                  s.matchSize === "" ||
                  (p.size ?? "") === s.matchSize)
            )
          : undefined
      return {
        productVariantId: (bySku ?? byColor)?.id ?? null,
        matchColor: s.matchColor,
        matchSize: s.matchSize,
        aeSkuId: s.aeSkuId,
        aePriceCents: s.aePriceCents > 0 ? s.aePriceCents : wholesale,
        aeShippingCents: resolved.aeShippingCents,
        aeLabel: s.aeLabel,
      }
    })
    await replaceSupplierLinkVariants(prisma, created.linkId, mappings)
    variantCount = variantPersist.variantInputs.length
    hasVariants = true
  }

  console.log("[admin-enlist-ae]", {
    result: "created",
    productId: created.product.id,
    aeProductId,
    aeSkuId: defaultAeSkuId ? `…${defaultAeSkuId.slice(-6)}` : null,
    wholesale,
    source: resolved.source,
    autoBuyEnabled,
    published: publish,
    supplierId,
    platformAutoBuy: usedPlatformAutoBuy,
    variantCount,
    specCount: meta.specs.length,
  })

  return {
    ok: true,
    productId: created.product.id,
    created: true,
    aeProductId,
    aeSkuId: defaultAeSkuId,
    aePriceCents: wholesale,
    name,
    autoBuyEnabled,
    published: publish,
    supplierId,
    source: resolved.source ?? "unknown",
    hasVariants,
    variantCount,
    specCount: meta.specs.length,
  }
}
