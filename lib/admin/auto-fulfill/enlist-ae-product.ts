import "server-only"

import { ensureResellerImportVaultSupplier } from "@/lib/affiliate-url-import.server"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import {
  AliExpressClient,
  createAliExpressClient,
} from "@/lib/aliexpress-open-api"
import { generateAffisellSku } from "@/lib/sku/generate"
import { prisma } from "@/lib/prisma"

export type EnlistAeProductInput = {
  aeUrl: string
  /** Optional display name override */
  name?: string | null
  /** Optional supplier; defaults to Affisell Import Vault (platform-owned) */
  supplierId?: string | null
  /** Override wholesale HT cents; otherwise resolved AE price */
  wholesalePriceCents?: number | null
  autoBuyEnabled?: boolean
  /**
   * When true, product is published (active, not draft).
   * Default false — admin finishes SKU mapping first.
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
 * Admin Instant Enlist: AliExpress URL → Product + SupplierLink (auto-buy ready).
 * Idempotent on `aliexpressProductId` — reuses existing draft/ops product when found.
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
  const publish = input.publish === true

  let supplierId = input.supplierId?.trim() || ""
  if (supplierId) {
    const supplier = await prisma.user.findFirst({
      where: { id: supplierId, role: "SUPPLIER" },
      select: { id: true },
    })
    if (!supplier) return { ok: false, error: "supplier_not_found" }
  } else {
    supplierId = await ensureResellerImportVaultSupplier()
  }

  const existing = await prisma.product.findFirst({
    where: { aliexpressProductId: aeProductId },
    select: {
      id: true,
      name: true,
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

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        autoBuyEnabled,
        autoFulfill: autoBuyEnabled,
        supplierSku: resolved.aeSkuId,
        supplierWholesaleCents: wholesale,
        sourceUrl: resolved.aeUrl,
        ...(publish ? { active: true, isDraft: false } : {}),
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
    })

    console.log("[admin-enlist-ae]", {
      result: "reused",
      productId: existing.id,
      aeProductId,
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
        basePriceCents,
        commissionRate: 10,
        stock: 999,
        active: publish,
        isDraft: !publish,
        importSource: "admin_ae_enlist",
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
    source: resolved.source ?? "unknown",
  }
}
