import type { Prisma } from "@prisma/client"

import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

const supplierStoreSelect = {
  userId: true,
  slug: true,
  name: true,
  description: true,
  bannerUrl: true,
  logoUrl: true,
  aiAvatarUrl: true,
  storefrontTheme: true,
  showSocialsOnStore: true,
  instagram: true,
  youtube: true,
  tiktok: true,
  twitch: true,
  facebook: true,
  twitter: true,
  isLive: true,
  liveUrl: true,
  livePlatform: true,
  user: {
    select: {
      role: true,
      isVerifiedSupplier: true,
      supplierTrustTier: true,
      supplierSuccessfulOrders: true,
      supplierMetrics: true,
    },
  },
} satisfies Prisma.StoreSelect

export type SupplierShopStore = Prisma.StoreGetPayload<{ select: typeof supplierStoreSelect }>

const catalogProductSelect = {
  id: true,
  name: true,
  basePriceCents: true,
  commissionRate: true,
  listingKind: true,
  stock: true,
  images: true,
  compareAt: true,
  isOnSale: true,
  createdAt: true,
  tags: true,
  deliveryMax: true,
  variants: true,
} satisfies Prisma.ProductSelect

export type SupplierCatalogProduct = Prisma.ProductGetPayload<{ select: typeof catalogProductSelect }>

export async function loadSupplierShopStore(slug: string): Promise<SupplierShopStore | null> {
  const key = slug.trim()
  if (!key) return null

  const store = await prisma.store.findFirst({
    where: {
      slug: key,
      user: { role: "SUPPLIER" },
    },
    select: supplierStoreSelect,
  })

  if (!store || store.user.role !== "SUPPLIER") return null
  return store
}

export async function loadSupplierShopCatalog(supplierUserId: string): Promise<{
  products: SupplierCatalogProduct[]
  partnerListingCountByProductId: Record<string, number>
}> {
  const supplierId = supplierUserId.trim()
  if (!supplierId) {
    return { products: [], partnerListingCountByProductId: {} }
  }

  const [products, partnerListingGroups] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId, ...buyerMarketplaceProductWhere },
      orderBy: { createdAt: "desc" },
      select: catalogProductSelect,
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { product: { supplierId }, isListed: true },
      _count: { _all: true },
    }),
  ])

  const partnerListingCountByProductId = Object.fromEntries(
    partnerListingGroups.map((row) => [row.productId, row._count._all])
  )

  return { products, partnerListingCountByProductId }
}
