import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { FeaturedShops } from "@/components/home/FeaturedShops"
import { ShopsDirectoryGrid } from "@/components/shops/ShopsDirectoryGrid"
import { loadPublicAffiliateShops } from "@/lib/shop-storefront-data"

/** Public SEO directory — revalidate hourly; buyer-safe fields only. */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shops")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
  }
}

async function loadShopsSafe() {
  try {
    return await loadPublicAffiliateShops()
  } catch (err) {
    console.error("[shops/page] loadPublicAffiliateShops failed:", err)
    return []
  }
}

export default async function ShopsDirectoryPage() {
  const shops = await loadShopsSafe()
  const t = await getTranslations("shops")

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
        <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </header>

      {shops.length === 0 ? (
        <FeaturedShops shops={[]} />
      ) : (
        <ShopsDirectoryGrid shops={shops} />
      )}
    </main>
  )
}
