import { buildAffiliateVariantOptions } from "@/lib/affiliate-storefront-variants"
import {
  parseVariantPricingBody,
  serializeVariantPricingForDb,
  type AffiliateVariantPricingMap,
} from "@/lib/affiliate-variant-pricing"

type ProductForVariantPricing = {
  colors: string[]
  variants: unknown
  basePriceCents: number
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}

/** Validate affiliate `variantPricing` body against catalog variant keys + wholesale floors. */
export function resolveVariantPricingBodyForProduct(args: {
  raw: unknown
  product: ProductForVariantPricing
}): { variantPricing: AffiliateVariantPricingMap | null } | { error: string } {
  if (args.raw === undefined) {
    return { variantPricing: null }
  }
  const options = buildAffiliateVariantOptions(args.product)
  const wholesaleByKey = new Map(options.map((o) => [o.key, o.wholesaleCents]))
  const parsed = parseVariantPricingBody({
    raw: args.raw,
    allowedKeys: options.map((o) => o.key),
    wholesaleByKey,
  })
  if ("error" in parsed) return parsed
  return { variantPricing: serializeVariantPricingForDb(parsed.variantPricing) }
}
