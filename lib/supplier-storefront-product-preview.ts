import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { decimalToNumber } from "@/lib/serialize-for-client"
import { prisma } from "@/lib/prisma"

export const supplierAffiliatePreviewProductSelect = {
  id: true,
  name: true,
  description: true,
  basePriceCents: true,
  compareAt: true,
  commissionRate: true,
  listingKind: true,
  stock: true,
  active: true,
  isDraft: true,
  images: true,
  categories: true,
  tags: true,
  deliveryMin: true,
  deliveryMax: true,
  handlingDays: true,
  shippingCountry: true,
  shippingType: true,
  variants: true,
  colorImages: true,
} as const

import type { SupplierAffiliatePreviewProduct } from "@/lib/supplier-affiliate-preview-types"

export type { SupplierAffiliatePreviewProduct } from "@/lib/supplier-affiliate-preview-types"

export async function loadSupplierStorefrontCatalogProduct(params: {
  storeSlug: string
  productId: string
  /** When true, includes draft/inactive SKUs (supplier dashboard only). */
  allowUnpublished?: boolean
}) {
  const storeSlug = params.storeSlug.trim()
  const productId = params.productId.trim()
  if (!storeSlug || !productId) return null

  const store = await prisma.store.findFirst({
    where: { slug: storeSlug, user: { role: "SUPPLIER" } },
    select: { userId: true, name: true, slug: true },
  })
  if (!store) return null

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      supplierId: store.userId,
      ...(params.allowUnpublished ? {} : buyerMarketplaceProductWhere),
    },
    select: supplierAffiliatePreviewProductSelect,
  })
  if (!product) return null

  const liveAffiliateListingWhere = {
    productId: product.id,
    isListed: true,
    product: { active: true },
    affiliate: { role: "AFFILIATE" as const },
  }

  const listedAffiliateCount = await prisma.affiliateProduct.groupBy({
    by: ["affiliateId"],
    where: liveAffiliateListingWhere,
  })

  const previewProduct: SupplierAffiliatePreviewProduct = {
    ...product,
    compareAt: decimalToNumber(product.compareAt),
  }

  return {
    store,
    product: previewProduct,
    listedAffiliateCount: listedAffiliateCount.length,
  }
}
