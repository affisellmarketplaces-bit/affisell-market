"use client"

import { Eye, Star, TrendingUp } from "lucide-react"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { formatStoreCount } from "@/lib/market-config"
import { shouldShowAffiliateCreatorsWatchingBadge } from "@/lib/affiliate-product-opportunity-pulse-shared"
import { cn } from "@/lib/utils"
import { t } from "../listing-detail-utils"

function StarRatingRow({ value, count }: { value: number; count: number }) {
  const full = Math.round(Math.min(5, Math.max(0, value)))
  return (
    <div className="flex items-center gap-1.5" aria-label={`${value.toFixed(1)} out of 5 stars, ${count} reviews`}>
      <div className="flex text-amber-400" role="presentation">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < full ? "fill-amber-400" : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"}`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}

type BrandClasses = ReturnType<typeof import("@/lib/storefront-pdp-brand").storefrontPdpBrandClasses>

type Props = {
  audience: "customer" | "merchant"
  brand: BrandClasses
  salesCount: number
  reviewSummary: { count: number; average: number }
  productT: {
    reviews: string
    trendingViews24h: string
    affiliateCreatorsWatchingOne: string
    affiliateCreatorsWatchingMany: string
    topVentes: string
  }
  viewsLast24h: number
  affiliateCreatorsWatching: number
}

export function TrustBadges({
  audience,
  brand,
  salesCount,
  reviewSummary,
  productT,
  viewsLast24h,
  affiliateCreatorsWatching,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      {salesCount > 0 ? (
        <ProductSalesBadge count={salesCount} variant="detail" className="w-full sm:w-auto" />
      ) : null}
      <StarRatingRow value={reviewSummary.average} count={reviewSummary.count} />
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {reviewSummary.average.toFixed(1)}
      </span>
      <a href="#listing-reviews" className={cn("text-sm", brand.accentText)}>
        {t(productT.reviews, { count: formatStoreCount(reviewSummary.count) })}
      </a>
      {viewsLast24h >= 12 ? (
        <span className="hidden rounded-full border border-orange-200/90 bg-gradient-to-r from-orange-50 to-amber-50 px-2 py-0.5 text-[10px] font-semibold text-orange-900 sm:inline-flex dark:border-orange-900/50 dark:from-orange-950/50 dark:to-amber-950/40 dark:text-orange-100">
          <TrendingUp className="mr-0.5 h-3 w-3 shrink-0" aria-hidden />
          {t(productT.trendingViews24h, { count: formatStoreCount(viewsLast24h) })}
        </span>
      ) : null}
      {audience === "customer" && shouldShowAffiliateCreatorsWatchingBadge(affiliateCreatorsWatching) ? (
        <span
          className="hidden rounded-full border border-violet-200/90 bg-gradient-to-r from-violet-50 to-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900 sm:inline-flex dark:border-violet-900/50 dark:from-violet-950/50 dark:to-indigo-950/40 dark:text-violet-100"
          data-testid="affiliate-creators-watching-badge"
        >
          <Eye className="mr-0.5 h-3 w-3 shrink-0" aria-hidden />
          {affiliateCreatorsWatching === 1
            ? t(productT.affiliateCreatorsWatchingOne, {
                count: formatStoreCount(affiliateCreatorsWatching),
              })
            : t(productT.affiliateCreatorsWatchingMany, {
                count: formatStoreCount(affiliateCreatorsWatching),
              })}
        </span>
      ) : null}
      {reviewSummary.count > 0 && reviewSummary.average >= 4.2 ? (
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:inline dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          {productT.topVentes}
        </span>
      ) : null}
    </div>
  )
}
