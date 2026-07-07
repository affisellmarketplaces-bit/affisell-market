"use client"

import Image from "next/image"
import Link from "next/link"
import { Eye, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { AffiliateCatalogEconomicsPanel } from "@/components/affiliate/affiliate-catalog-economics-panel"
import { Button } from "@/components/ui/button"
import type { AffiliateOpportunityPulseCard } from "@/lib/affiliate-catalog-opportunity-pulse"
import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

type Props = {
  picks: AffiliateOpportunityPulseCard[]
  className?: string
  /** Catalog modal flow */
  onListNow?: (productId: string, listingId: string | null) => void
  /** Hub deep-link flow */
  catalogListHref?: (productId: string) => string
  compact?: boolean
}

export function AffiliateOpportunityPulseRail({
  picks,
  className,
  onListNow,
  catalogListHref,
  compact = false,
}: Props) {
  const t = useTranslations("affiliate.opportunityPulse")

  if (picks.length === 0) return null

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50/80 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-indigo-950/30 sm:p-5",
        className
      )}
      data-testid="affiliate-opportunity-pulse-rail"
      aria-labelledby="affiliate-opportunity-pulse-heading"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <Sparkles className="size-4" aria-hidden />
            {t("eyebrow")}
          </p>
          <h2
            id="affiliate-opportunity-pulse-heading"
            className={cn("mt-1 font-bold text-zinc-900 dark:text-zinc-50", compact ? "text-lg" : "text-xl")}
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("hint")}</p>
        </div>
        <Link
          href={AFFILIATE_CATALOG_PATH}
          className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
        >
          {t("viewCatalog")}
        </Link>
      </div>

      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {picks.map((item) => {
          const watchingLabel =
            item.affiliateCreatorsWatching === 1
              ? t("watchingOne", { count: item.affiliateCreatorsWatching })
              : t("watchingMany", { count: item.affiliateCreatorsWatching })

          const listHref =
            catalogListHref?.(item.productId) ??
            `${AFFILIATE_CATALOG_PATH}?productId=${encodeURIComponent(item.productId)}`

          return (
            <li
              key={item.productId}
              className="w-[min(100%,16rem)] shrink-0 snap-start rounded-xl border border-violet-200/70 bg-white/90 p-3 dark:border-violet-900/40 dark:bg-zinc-950/80"
            >
              <div className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Image
                    src={item.imageUrl || "/placeholder-product.jpg"}
                    alt=""
                    fill
                    className="object-contain p-1"
                    sizes="64px"
                    unoptimized={Boolean(item.imageUrl?.startsWith("http"))}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900 dark:bg-violet-950/60 dark:text-violet-100">
                    <Eye className="size-3" aria-hidden />
                    {watchingLabel}
                  </p>
                  <AffiliateCatalogEconomicsPanel
                    economics={buildAffiliateCatalogCardEconomics(
                      item.basePriceCents,
                      item.commissionRate
                    )}
                    variant="compact"
                    className="mt-2"
                  />
                </div>
              </div>
              {onListNow ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 h-9 w-full rounded-lg bg-violet-600 text-xs font-semibold hover:bg-violet-700"
                  onClick={() => onListNow(item.productId, item.listingId)}
                >
                  {item.isInStore ? t("editListing") : t("listNow")}
                </Button>
              ) : (
                <Link
                  href={listHref}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-violet-600 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  {t("listNow")}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
