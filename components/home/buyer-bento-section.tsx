import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Bot, Sparkles, Store, TrendingUp } from "lucide-react"

import { BentoCard } from "@/components/marketing/bento-card"
import { AnimatedCounter } from "@/components/marketing/animated-counter"
import { StaggerIn, StaggerItem } from "@/components/marketing/stagger-in"
import {
  loadFeaturedShopsSafe,
  loadHomeBestSellers7dSafe,
  loadHomeMarketplaceStatsSafe,
} from "@/lib/public-home-data"
import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export async function BuyerBentoSection() {
  const t = await getTranslations("home.bento")
  const [stats, shops, trending] = await Promise.all([
    loadHomeMarketplaceStatsSafe(),
    loadFeaturedShopsSafe(4),
    loadHomeBestSellers7dSafe(3),
  ])

  return (
    <StaggerIn className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StaggerItem>
        <BentoCard
          title={t("agentShopping.title")}
          description={t("agentShopping.description")}
        >
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          >
            <Bot className="h-4 w-4" aria-hidden />
            AI
          </Link>
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard
          title={t("featuredStores.title")}
          description={t("featuredStores.description")}
        >
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {shops.map((shop) => (
              <li key={shop.slug} className="shrink-0">
                <Link
                  href={`${PUBLIC_SHOPS_PATH}/${shop.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-100 px-2 py-1.5 text-xs dark:border-zinc-800"
                >
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- creator CDN hosts vary
                    <img
                      src={shop.logoUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Store className="h-5 w-5 text-violet-600" aria-hidden />
                  )}
                  <span className="max-w-[6rem] truncate font-medium">{shop.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard
          title={t("liveCatalog.title")}
          description={t("liveCatalog.description")}
        >
          <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
            <AnimatedCounter value={stats.productCount} />
            <span className="text-base font-medium text-zinc-500">
              {t("liveCatalog.counterSuffix")}
            </span>
          </p>
        </BentoCard>
      </StaggerItem>
      <StaggerItem>
        <BentoCard title={t("trending.title")} description={t("trending.description")}>
          <ul className="space-y-2">
            {trending.map((p) => (
              <li key={p.listingId} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 truncate">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                <span className="shrink-0 text-zinc-500">
                  {formatStoreCurrencyFromCents(p.priceCents)}
                </span>
              </li>
            ))}
            {trending.length === 0 ? (
              <li className="flex items-center gap-2 text-zinc-500">
                <Sparkles className="h-4 w-4" aria-hidden />
                —
              </li>
            ) : null}
          </ul>
        </BentoCard>
      </StaggerItem>
    </StaggerIn>
  )
}
