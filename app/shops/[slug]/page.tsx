import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { redirectAffiliateShopHomeToBoutique } from "@/lib/boutique/redirect-affiliate-shop-to-boutique.server"
import { loadAffiliateShopStoreCached } from "@/lib/shop-storefront-cache"
import {
  e2eFlashSaleShopFixture,
  shouldUseE2eStorefrontFlashSaleFixtures,
} from "@/lib/e2e-storefront-flash-sale-fixtures"

import LegacyShopSlugPage from "./legacy-shop-home-page"

export const revalidate = 60

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
  searchParams: Promise<{ cat?: string; e2eFlashSale?: string; preview?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])

  if (!shouldUseE2eStorefrontFlashSaleFixtures({ e2eFlashSale: sp.e2eFlashSale })) {
    redirectAffiliateShopHomeToBoutique(slug, sp)
  }

  return <LegacyShopSlugPage slug={slug} searchParams={sp} fixture={e2eFlashSaleShopFixture()} />
}
