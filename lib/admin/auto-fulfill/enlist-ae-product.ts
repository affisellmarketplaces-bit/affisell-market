import "server-only"

import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import {
  AFFISELL_AUTOBUY_IMPORT_SOURCE,
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  ensureAffisellAutoBuySupplier,
} from "@/lib/auto-buy-platform-supplier"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import {
  AliExpressClient,
  createAliExpressClient,
} from "@/lib/aliexpress-open-api"
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
}

export type EnlistAeProductError = {
  ok: false
  error: string
}

async function resolveProductTitle(
  aeProductId: string,
  fallback: string
): Promise<{ name: string; images: string[]; description: string }> {
  if (!AliExpressClient.isConfigured()) {
    return { name: fallback, images: [], description: `Auto-buy AE ${aeProductId}` }
  }
  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(aeProductId)
    const mapped = mapAliExpressGetProductResponse(raw, aeProductId)
    return {
      name: mapped.name?.trim() || fallback,
      images: mapped.images.slice(0, 8),
      description: mapped.description?.trim() || `Auto-buy AE — ${mapped.name || aeProductId}`,
    }
  } catch {
    return { name: fallback, images: [], description: `Auto-buy AE ${aeProductId}` }
  }
}

/**
 * Instant Enlist: AliExpress URL → Product + SupplierLink under Affisell AutoBuy
 * (or an explicit supplier), published for resellers by default.
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

  const wholesale =
    input.wholesalePriceCents != null &&
    Number.isFinite(input.wholesalePriceCents) &&
    input.wholesalePriceCents > 0
      ? Math.floor(input.wholesalePriceCents)
      : Math.max(1, resolved.aePriceCents || 1)

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
    },
    orderBy: { updatedAt: "desc" },
  })

  if (existing) {
    await prisma.supplierLink.upsert({
      where: { productId: existing.id },
      create: {
        productId: existing.id,
        aeUrl: resolved.aeUrl,
        aeProductId,
        aeSkuId: resolved.aeSkuId,
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
        aeSkuId: resolved.aeSkuId ?? undefined,
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
        supplierSku: resolved.aeSkuId,
        supplierWholesaleCents: wholesale,
        sourceUrl: resolved.aeUrl,
        ...(publish ? { active: true, isDraft: false } : {}),
        ...(canReassignToPlatform ? { supplierId } : {}),
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
    })

    console.log("[admin-enlist-ae]", {
      result: "reused",
      productId: existing.id,
      aeProductId,
      supplierId: canReassignToPlatform ? supplierId : existing.supplierId,
      published: publish,
      source: resolved.source,
    })

    return {
      ok: true,
      productId: existing.id,
      created: false,
      aeProductId,
      aeSkuId: resolved.aeSkuId,
      aePriceCents: wholesale,
      name: input.name?.trim() || existing.name,
      autoBuyEnabled,
      published: publish,
      supplierId: canReassignToPlatform ? supplierId : existing.supplierId,
      source: resolved.source ?? "unknown",
    }
  }

  const fallbackName = `AE ${aeProductId}`
  const meta = await resolveProductTitle(
    aeProductId,
    input.name?.trim() || fallbackName
  )
  const name = input.name?.trim() || meta.name || fallbackName
  const affisellSku = await generateAffisellSku()
  const basePriceCents = Math.max(wholesale, Math.round(wholesale * 1.35))

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        supplierId,
        name,
        description: meta.description,
        images: meta.images,
        categories: ["Auto-buy"],
        tags: usedPlatformAutoBuy ? ["affisell-autobuy"] : [],
        basePriceCents,
        commissionRate: 10,
        stock: 999,
        active: publish,
        isDraft: !publish,
        importSource: AFFISELL_AUTOBUY_IMPORT_SOURCE,
        sourceUrl: resolved.aeUrl,
        aliexpressProductId: aeProductId,
        affisellSku,
        autoBuyEnabled,
        autoFulfill: autoBuyEnabled,
        supplierSku: resolved.aeSkuId,
        supplierWholesaleCents: wholesale,
        hasVariants: false,
      },
    })

    await tx.supplierLink.create({
      data: {
        productId: product.id,
        aeUrl: resolved.aeUrl,
        aeProductId,
        aeSkuId: resolved.aeSkuId,
        aeShopId: resolved.aeShopId || "",
        aePriceCents: wholesale,
        aeShippingCents: resolved.aeShippingCents,
        autoBuyEnabled,
        isActive: true,
        lastSyncAt: new Date(),
      },
    })

    return product
  })

  console.log("[admin-enlist-ae]", {
    result: "created",
    productId: created.id,
    aeProductId,
    aeSkuId: resolved.aeSkuId ? `…${resolved.aeSkuId.slice(-6)}` : null,
    wholesale,
    source: resolved.source,
    autoBuyEnabled,
    published: publish,
    supplierId,
    platformAutoBuy: usedPlatformAutoBuy,
  })

  return {
    ok: true,
    productId: created.id,
    created: true,
    aeProductId,
    aeSkuId: resolved.aeSkuId,
    aePriceCents: wholesale,
    name,
    autoBuyEnabled,
    published: publish,
    supplierId,
    source: resolved.source ?? "unknown",
  }
}
