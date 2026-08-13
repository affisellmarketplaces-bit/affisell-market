import {
  lookupVariantPricingEntry,
  parseAffiliateVariantPricingJson,
} from "@/lib/affiliate-variant-pricing"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import {
  loadResellerStorefrontProduct,
  resolveResellerDefaultListingCommerce,
} from "@/lib/boutique/load-reseller-storefront.server"
import { prisma } from "@/lib/prisma"
import { variantsFromDb } from "@/lib/product-variants"

export type CreateResellerOrderInput = {
  storeSlug: string
  productId: string
  customerEmail?: string | null
}

export type CreateResellerOrderResult =
  | {
      success: true
      orderId: string
      marginCents: number
      sellingPriceCents: number
    }
  | {
      success: false
      error: string
    }

function resolveWholesalePriceCents(args: {
  sellingPriceCents: number
  defaultOptionName: string | null
  variantPricingRaw: unknown
  productBasePriceCents: number
  activeVariantWholesaleCents: number | null
}): number {
  const variantPricing = parseAffiliateVariantPricingJson(args.variantPricingRaw)
  const pricingEntry = lookupVariantPricingEntry(variantPricing, args.defaultOptionName)
  if (pricingEntry?.marginCents != null && pricingEntry.marginCents >= 0) {
    return Math.max(0, args.sellingPriceCents - pricingEntry.marginCents)
  }
  if (args.activeVariantWholesaleCents != null && args.activeVariantWholesaleCents > 0) {
    return args.activeVariantWholesaleCents
  }
  return Math.max(0, args.productBasePriceCents)
}

export async function createResellerOrder(
  input: CreateResellerOrderInput
): Promise<CreateResellerOrderResult> {
  const storeSlug = input.storeSlug?.trim()
  const productId = input.productId?.trim()
  if (!storeSlug || !productId) {
    return { success: false, error: "missing_fields" }
  }

  const storefront = await loadResellerStorefrontProduct(productId)
  if (!storefront) {
    return { success: false, error: "listing_not_found" }
  }
  if (storefront.isOutOfStock) {
    return { success: false, error: "out_of_stock" }
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: productId,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      marginCents: true,
      affiliateId: true,
      product: {
        select: {
          id: true,
          supplierId: true,
          basePriceCents: true,
          stock: true,
          variants: true,
          colors: true,
          customColumns: true,
          productVariants: {
            select: {
              id: true,
              color: true,
              size: true,
              stock: true,
              customData: true,
              supplierPrice: true,
              wholesalePriceCents: true,
            },
          },
        },
      },
    },
  })

  if (!listing?.product) {
    return { success: false, error: "listing_not_found" }
  }

  const commerce = resolveResellerDefaultListingCommerce({
    listingSellingPriceCents: listing.sellingPriceCents,
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: {
      basePriceCents: listing.product.basePriceCents,
      stock: listing.product.stock,
      variants: listing.product.variants,
      colors: listing.product.colors ?? [],
      customColumns: listing.product.customColumns,
      productVariants: listing.product.productVariants ?? [],
    },
  })

  const sellingPriceCents = commerce.priceCents
  const parsedVariants = variantsFromDb(listing.product.variants)
  const activeVariantRow = commerce.defaultOptionName
    ? parsedVariants?.variantRows?.find(
        (row) => row.name.trim().toLowerCase() === commerce.defaultOptionName!.trim().toLowerCase()
      )
    : undefined

  const wholesalePriceCents = resolveWholesalePriceCents({
    sellingPriceCents,
    defaultOptionName: commerce.defaultOptionName,
    variantPricingRaw: listing.variantPricing,
    productBasePriceCents: listing.product.basePriceCents,
    activeVariantWholesaleCents: activeVariantRow?.priceCents ?? null,
  })

  const marginCents = Math.max(0, sellingPriceCents - wholesalePriceCents)
  const orderId = `reseller_${Date.now()}`

  console.log("[reseller-order]", {
    storeSlug,
    productId,
    customerEmail: input.customerEmail?.trim() || null,
    sellingPriceCents,
    wholesalePriceCents,
    marginCents,
    defaultOptionName: commerce.defaultOptionName,
    affiliateId: listing.affiliateId,
    supplierId: listing.product.supplierId,
    orderId,
    persisted: false,
    result: "dry_run",
  })

  return {
    success: true,
    orderId,
    marginCents,
    sellingPriceCents,
  }
}
