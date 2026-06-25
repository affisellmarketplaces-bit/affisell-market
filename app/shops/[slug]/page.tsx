import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { StorefrontHomeSections } from "@/components/storefront/storefront-home-sections"
import {
  filterShopProductsByCategory,
  groupShopProductsByCategory,
} from "@/lib/shop-storefront-categories"
import {
  loadAffiliateShopProductsCached,
  loadAffiliateShopStoreCached,
  loadAffiliateStorefrontTrustCached,
  SHOP_REVALIDATE_SEC,
} from "@/lib/shop-storefront-cache"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"

export const revalidate = SHOP_REVALIDATE_SEC

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const store = await loadAffiliateShopStoreCached(slug)
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
  searchParams: Promise<{ cat?: string }>
}) {
  const { slug } = await params
  const { cat } = await searchParams
  const hdrs = await headers()
  const isDedicatedHost = isCustomDomainHeaders(hdrs)

  const [storeFront, trust, products] = await Promise.all([
    loadAffiliateShopStoreCached(slug),
    loadAffiliateStorefrontTrustCached(slug),
    loadAffiliateShopProductsCached(slug),
  ])
  if (!storeFront) notFound()

  const categories = groupShopProductsByCategory(products)
  const activeCategory =
    typeof cat === "string" && cat.length > 0
      ? categories.find((c) => c.slug === cat) ?? null
      : null
  const visibleProducts = filterShopProductsByCategory(products, activeCategory?.id ?? null)

  return (
    <StorefrontHomeSections
      store={storeFront}
      trust={trust}
      slug={slug}
      products={visibleProducts}
      activeCategoryLabel={activeCategory?.name ?? null}
      isDedicatedHost={isDedicatedHost}
    />
  )
}
