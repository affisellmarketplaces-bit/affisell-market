import { getTranslations } from "next-intl/server"
import { Bot } from "lucide-react"

import { AnimatedCounter } from "@/components/AnimatedCounter"
import { BentoCard } from "@/components/marketing/bento-card"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import { FeaturedStoresCarousel } from "@/components/FeaturedStoresCarousel"
import { TrendingSparkline } from "@/components/TrendingSparkline"
import { Link } from "@/i18n/navigation"
import {
  loadFeaturedShopsCached,
  loadHomeBestSellers7dCached,
  loadHomeMarketplaceStatsCached,
} from "@/lib/public-home-cache"

export async function BentoGrid() {
  const t = await getTranslations("home.bento")
  const [stats, shops, trending] = await Promise.all([
    loadHomeMarketplaceStatsCached(),
    loadFeaturedShopsCached(6),
    loadHomeBestSellers7dCached(4),
  ])

  return (
    <StaggerIn className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
      <StaggerItem>
        <BentoCard
          variant="glass-indigo"
          title={t("agentShopping.title")}
          description={t("agentShopping.description")}
        >
          <Link
            href="/agent"
            className="relative inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-violet-100 backdrop-blur-md transition hover:bg-white/15 hover:text-white"
          >
            <Bot className="h-4 w-4" aria-hidden />
            {t("agentShopping.cta")}
          </Link>
        </BentoCard>
      </StaggerItem>
      <StaggerItem className="md:col-span-2 lg:col-span-1">
        <BentoCard
          variant="glass-indigo"
          title={t("featuredStores.title")}
          description={t("featuredStores.description")}
          colSpan="wide"
        >
          <FeaturedStoresCarousel shops={shops} />
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard
          variant="glass-indigo"
          title={t("liveCatalog.title")}
          description={t("liveCatalog.description")}
        >
          <p className="relative text-3xl font-bold text-violet-200">
            <AnimatedCounter end={stats.productCount} suffix={t("liveCatalog.counterSuffix")} />
          </p>
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard variant="glass-indigo" title={t("trending.title")} description={t("trending.description")}>
          <TrendingSparkline items={trending} />
        </BentoCard>
      </StaggerItem>
    </StaggerIn>
  )
}
