import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ProductGrid } from "@/components/shop/ProductGrid"
import type { ProductCardDisplayMode } from "@/components/product/ProductCard"
import { auth } from "@/auth"
import {
  filterShopProductsByCategory,
  groupShopProductsByCategory,
} from "@/lib/shop-storefront-categories"
import { loadAffiliateShopProducts, loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const store = await loadAffiliateShopStore(slug)
  const t = await getTranslations("shops")
  const tDiscovery = await getTranslations("discovery")
  if (!store) return { title: t("title") }
  const niche = tDiscovery(`niches.${store.nicheLabel}`)
  return {
    title: t("storeMetaTitle", { name: store.name, niche }),
    description:
      store.description?.slice(0, 160) ?? t("storeMetaDescription", { name: store.name, niche }),
    robots: { index: true, follow: true },
  }
}

export default async function ShopSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string; cat?: string }>
}) {
  const { slug } = await params
  const { preview, cat } = await searchParams
  const session = await auth()
  const hdrs = await headers()
  const isDedicatedHost = isCustomDomainHeaders(hdrs)

  const [storeMeta, storeFront] = await Promise.all([
    prisma.store.findUnique({
      where: { slug },
      select: { userId: true, user: { select: { role: true } } },
    }),
    loadAffiliateShopStore(slug),
  ])
  if (!storeMeta || storeMeta.user.role !== "AFFILIATE") notFound()

  const affiliatePreview =
    preview === "affiliate" && session?.user?.role === "AFFILIATE"

  const cardMode: ProductCardDisplayMode = affiliatePreview ? "affiliate" : "customer"

  const products = await loadAffiliateShopProducts(storeMeta.userId, {
    includeBusinessFields: affiliatePreview,
  })

  const categories = groupShopProductsByCategory(products)
  const activeCategory =
    typeof cat === "string" && cat.length > 0
      ? categories.find((c) => c.slug === cat) ?? null
      : null
  const visibleProducts = filterShopProductsByCategory(products, activeCategory?.id ?? null)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <ProductGrid
        storeSlug={slug}
        products={visibleProducts}
        mode={cardMode}
        gridDensity={storeFront?.theme.gridDensity}
        dedicatedHost={isDedicatedHost}
        activeCategoryLabel={activeCategory?.name ?? null}
      />
    </div>
  )
}
