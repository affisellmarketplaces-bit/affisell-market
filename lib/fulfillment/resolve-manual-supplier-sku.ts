import type { ResolvedSupplierSku } from "@/lib/fulfillment/resolve-supplier-sku"
import { mergeAeVariantMappingForOrder, type ProductVariantAeRow } from "@/lib/fulfillment/merge-ae-variant-mapping"

export type ManualSupplierSkuProduct = {
  supplierSku: string | null
  supplierWholesaleCents: number | null
  variantMapping: unknown
  productVariants: ProductVariantAeRow[]
}

/** Prefer manually entered AE SKU + wholesale on Product / ProductVariant. */
export function resolveManualSupplierSku(
  product: ManualSupplierSkuProduct,
  order: { variantLabel: string | null; variantSignature?: string | null },
  fallbackPriceCents: number,
  fallbackShippingCents: number
): ResolvedSupplierSku | null {
  const { matchedVariant } = mergeAeVariantMappingForOrder({
    productVariantMapping: product.variantMapping,
    productVariants: product.productVariants,
    order,
  })

  const aeSkuId =
    matchedVariant?.supplierSku?.trim() ||
    product.supplierSku?.trim() ||
    null

  if (!aeSkuId) return null

  const aePriceCents =
    matchedVariant?.wholesalePriceCents ??
    product.supplierWholesaleCents ??
    fallbackPriceCents

  return {
    aeSkuId,
    aePriceCents: Math.max(0, aePriceCents),
    aeShippingCents: fallbackShippingCents,
    source: "variant_mapping",
    mappingId: matchedVariant?.id ?? null,
  }
}
