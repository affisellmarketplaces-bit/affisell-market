import { createAliExpressClient } from "@/lib/aliexpress-open-api"
import { isAliExpressApiReady } from "@/lib/aliexpress-api-ready.server"
import { parseAeProductSkusFromPayload } from "@/lib/fulfillment/ae-product-skus"
import {
  buildSkuPropertyLookupFromApiPayload,
  type AeSkuPropValueMeta,
} from "@/lib/fulfillment/ae-sku-property-lookup"
import { hydrateAeSkuRowImages } from "@/lib/fulfillment/ae-sku-image-hydrate"
import { unwrapAliExpressMethodResponse } from "@/lib/aliexpress-open-api"
import {
  enrichColorImagesFromProductVariants,
  mergeColorImagesForProduct,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import { parseVariantsPayload } from "@/lib/product-variants"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function parseSkuList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => Boolean(x))
  }
  return []
}

function variantRowsMissingImages(
  productVariants: Array<{ color: string | null; customData?: unknown }>,
  colorImages: ProductColorImageRow[]
): boolean {
  if (productVariants.length < 2) return false
  let missing = 0
  for (const v of productVariants) {
    const custom =
      v.customData && typeof v.customData === "object" && !Array.isArray(v.customData)
        ? (v.customData as Record<string, unknown>).image
        : null
    const fromCustom = typeof custom === "string" && /^https?:\/\//i.test(custom.trim())
    const row = v.color
      ? colorImages.find((c) => c.color.toLowerCase() === v.color!.toLowerCase())
      : undefined
    const fromRow = Boolean(row?.image?.trim())
    if (!fromCustom && !fromRow) missing += 1
  }
  return missing / productVariants.length >= 0.5
}

export type AeVariantImageBackfill = {
  productVariants: Array<{
    id?: string
    color: string | null
    size: string | null
    stock: number
    sku?: string | null
    customData?: unknown
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
  colorImages: ProductColorImageRow[]
  backfilled: boolean
}

/** Idempotent — writes swatch URLs once when AE backfill succeeds. */
export async function persistAeVariantImageBackfill(
  productId: string,
  backfill: AeVariantImageBackfill
): Promise<void> {
  if (!backfill.backfilled) return

  const updates = backfill.productVariants.filter((v) => {
    if (!v.id) return false
    const img =
      v.customData && typeof v.customData === "object" && !Array.isArray(v.customData)
        ? (v.customData as Record<string, unknown>).image
        : null
    return typeof img === "string" && /^https?:\/\//i.test(img.trim())
  })

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        colorImages: backfill.colorImages as unknown as Prisma.InputJsonValue,
      },
    })
    for (const row of updates) {
      if (!row.id) continue
      await tx.productVariant.update({
        where: { id: row.id },
        data: { customData: row.customData as Prisma.InputJsonValue },
      })
    }
  })

  console.log("[ae-variant-image-backfill]", {
    productId,
    result: "persisted",
    variantUpdates: updates.length,
  })
}

/**
 * Live AE API backfill for listing builder when DB rows lack swatch photos.
 * Response-only — does not write to DB (safe on GET).
 */
export async function backfillAeVariantImagesForCatalogProduct(product: {
  aliexpressProductId?: string | null
  colors?: string[]
  colorImages?: unknown
  variants?: unknown
  productVariants?: Array<{
    id?: string
    color: string | null
    size: string | null
    stock: number
    sku?: string | null
    customData?: unknown
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}): Promise<AeVariantImageBackfill> {
  const productVariants = product.productVariants ?? []
  const colors = product.colors ?? []
  const merged = enrichColorImagesFromProductVariants(
    mergeColorImagesForProduct(colors, product.colorImages, product.variants),
    productVariants
  )

  const aeId = product.aliexpressProductId?.trim()
  if (!aeId || productVariants.length < 2 || !variantRowsMissingImages(productVariants, merged)) {
    return { productVariants, colorImages: merged, backfilled: false }
  }

  if (!(await isAliExpressApiReady())) {
    return { productVariants, colorImages: merged, backfilled: false }
  }

  try {
    const client = await createAliExpressClient()
    const payload = await client.getProduct(aeId)
    const methodNode = unwrapAliExpressMethodResponse(payload, "aliexpress.ds.product.get")
    const result = asRecord(methodNode?.result) ?? methodNode ?? {}
    const skus = parseSkuList(
      result.ae_item_sku_info_dtos ??
        result.ae_item_sku_info_dto ??
        result.sku_info ??
        result.skus
    )
    const lookup: Map<string, AeSkuPropValueMeta> = buildSkuPropertyLookupFromApiPayload(result, skus)
    const parsed = parseAeProductSkusFromPayload(payload, aeId)
    const variantPayload = parseVariantsPayload(product.variants)
    const hydrated = hydrateAeSkuRowImages(parsed, {
      lookup,
      variantRows: (variantPayload?.variantRows ?? []).map((r) => ({
        name: r.name,
        image: r.image,
      })),
    })

    const bySkuId = new Map(hydrated.filter((r) => r.aeSkuId).map((r) => [r.aeSkuId, r]))
    const byLabel = new Map(
      hydrated
        .filter((r) => r.aeLabel.trim())
        .map((r) => [r.aeLabel.trim().toLowerCase(), r])
    )
    const byColor = new Map(
      hydrated
        .filter((r) => r.matchColor || r.aeLabel)
        .map((r) => [(r.matchColor ?? r.aeLabel).toLowerCase(), r])
    )

    let touched = 0
    const enrichedVariants = productVariants.map((v) => {
      const skuKey = typeof v.sku === "string" ? v.sku.trim() : ""
      const custom =
        v.customData && typeof v.customData === "object" && !Array.isArray(v.customData)
          ? (v.customData as Record<string, unknown>)
          : {}
      const aeLabel =
        (typeof custom.aeLabel === "string" ? custom.aeLabel.trim() : "") ||
        v.color?.trim() ||
        ""
      const fromSku = skuKey ? bySkuId.get(skuKey) : undefined
      const fromLabel = aeLabel ? byLabel.get(aeLabel.toLowerCase()) : undefined
      const colorKey = v.color?.trim().toLowerCase() ?? ""
      const fromColor = colorKey ? byColor.get(colorKey) : undefined
      const hit = fromSku ?? fromLabel ?? fromColor
      const imageUrl = hit?.imageUrl ?? null
      if (!imageUrl) return v

      const existing =
        v.customData && typeof v.customData === "object" && !Array.isArray(v.customData)
          ? (v.customData as Record<string, unknown>)
          : {}
      if (typeof existing.image === "string" && /^https?:\/\//i.test(existing.image.trim())) {
        return v
      }

      touched += 1
      const aeLabelFromHit = hit?.aeLabel?.trim()
      return {
        ...v,
        customData: {
          ...existing,
          ...(aeLabelFromHit ? { aeLabel: aeLabelFromHit } : {}),
          image: imageUrl,
        },
      }
    })

    const colorImages = enrichColorImagesFromProductVariants(merged, enrichedVariants)

    if (touched > 0) {
      console.log("[ae-variant-image-backfill]", {
        aeProductId: aeId,
        result: "ok",
        touched,
        total: productVariants.length,
      })
    }

    return {
      productVariants: enrichedVariants,
      colorImages,
      backfilled: touched > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log("[ae-variant-image-backfill]", {
      aeProductId: aeId,
      result: "skip",
      error: msg.slice(0, 160),
    })
    return { productVariants, colorImages: merged, backfilled: false }
  }
}
