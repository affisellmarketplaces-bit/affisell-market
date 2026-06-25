import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { StorefrontHomeSections } from "@/components/storefront/storefront-home-sections"
import {
  filterShopProductsByCategory,
  groupShopProductsByCategory,
} from "@/lib/shop-storefront-categories"
import { loadAffiliateStorefrontTrust } from "@/lib/load-affiliate-storefront-trust"
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
  searchParams: Promise<{ cat?: string }>
}) {
  const { slug } = await params
  const { cat } = await searchParams
  const hdrs = await headers()
  const isDedicatedHost = isCustomDomainHeaders(hdrs)

  const [storeMeta, storeFront, trust] = await Promise.all([
    prisma.store.findUnique({
      where: { slug },
      select: { userId: true, user: { select: { role: true } } },
    }),
    loadAffiliateShopStore(slug),
    loadAffiliateStorefrontTrust(slug),
  ])
  if (!storeMeta || storeMeta.user.role !== "AFFILIATE" || !storeFront) notFound()

  const products = await loadAffiliateShopProducts(storeMeta.userId)

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
