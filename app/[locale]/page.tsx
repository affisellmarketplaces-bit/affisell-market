import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BuyerHeroBlock } from "@/components/BuyerHeroBlock"
import { MarketingFooter } from "@/components/MarketingFooter"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { ShimmerSkeleton } from "@/components/marketing/shimmer-skeleton"
import { routing } from "@/i18n/routing"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "home.meta" })
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  }
}

async function CatalogFallback() {
  const t = await getTranslations("home")
  return (
    <div className="space-y-3 rounded-3xl border border-dashed border-gray-100 p-6 dark:border-gray-800">
      <ShimmerSkeleton className="h-8 w-48" />
      <ShimmerSkeleton className="h-32 w-full" />
      <p className="text-center text-sm text-zinc-500">{t("loadingCatalog")}</p>
    </div>
  )
}

export default async function LocaleHomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (session?.user?.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session?.user?.role === "AFFILIATE") redirect("/dashboard/affiliate")

  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <BuyerHeroBlock />
      <BentoGrid />
      <Suspense fallback={<CatalogFallback />}>
        <BuyerMarketplaceExplorer />
      </Suspense>
      <MarketingFooter />
    </main>
  )
}
