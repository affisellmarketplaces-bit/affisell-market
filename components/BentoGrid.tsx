import { getTranslations } from "next-intl/server"
import { Bot } from "lucide-react"

import { AnimatedCounter } from "@/components/AnimatedCounter"
import { BentoCard } from "@/components/marketing/bento-card"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { FeaturedStoresCarousel } from "@/components/FeaturedStoresCarousel"
import { TrendingSparkline } from "@/components/TrendingSparkline"
import { Link } from "@/i18n/navigation"
import {
  loadFeaturedShopsSafe,
  loadHomeBestSellers7dSafe,
  loadHomeMarketplaceStatsSafe,
} from "@/lib/public-home-data"

export async function BentoGrid() {
  const t = await getTranslations("home.bento")
  const [stats, shops, trending] = await Promise.all([
    loadHomeMarketplaceStatsSafe(),
    loadFeaturedShopsSafe(6),
    loadHomeBestSellers7dSafe(4),
  ])

  return (
    <StaggerIn className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StaggerItem>
        <BentoCard title={t("agentShopping.title")} description={t("agentShopping.description")}>
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-[#6366F1] dark:bg-indigo-950"
          >
            <Bot className="h-4 w-4" aria-hidden />
            AI
          </Link>
        </BentoCard>
      </StaggerItem>
      <StaggerItem className="md:col-span-2 lg:col-span-1">
        <BentoCard
          title={t("featuredStores.title")}
          description={t("featuredStores.description")}
          colSpan="wide"
        >
          <FeaturedStoresCarousel shops={shops} />
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard title={t("liveCatalog.title")} description={t("liveCatalog.description")}>
          <p className="text-3xl font-bold text-[#6366F1]">
            <AnimatedCounter end={stats.productCount} suffix={t("liveCatalog.counterSuffix")} />
          </p>
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard title={t("trending.title")} description={t("trending.description")}>
          <TrendingSparkline items={trending} />
        </BentoCard>
      </StaggerItem>
    </StaggerIn>
  )
}
