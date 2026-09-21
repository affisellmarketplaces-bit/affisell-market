import { getTranslations } from "next-intl/server"
import { ArrowDownRight, ArrowUpRight, Landmark, ShieldAlert, Store, TrendingUp } from "lucide-react"

import { KpiTile as Tile, type KpiTone as Tone } from "@/components/dashboard/kpi-tile"
import { MiniSparkline } from "@/components/supplier/mission-control/mini-sparkline"
import { periodChangePct } from "@/lib/analytics-compare"
import { formatMoneyFromCents } from "@/lib/app-locale-format"
import { CLAWBACK_RISK_WARNING_CENTS } from "@/lib/affiliate-clawback-risk"
import type { AffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics-types"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

/**
 * The four numbers a reseller checks first: what I earned, what is about to be paid, my listings, and the refund
 * risk on commissions already earned. Each tile opens the page where it can be acted on.
 */
export async function AffiliateKpiStrip({
  analytics,
  liveListings,
  draftListings,
  clawbackRiskCents,
  locale,
}: {
  analytics: AffiliateDashboardAnalytics
  liveListings: number
  draftListings: number
  clawbackRiskCents: number
  locale: AppLocale
}) {
  const t = await getTranslations("affiliateDashboard.kpi")
  const money = (cents: number) => formatMoneyFromCents(cents, locale, { maximumFractionDigits: 0 })

  const series = analytics.dailyRevenue.map((d) => d.revenueCents)
  const trendPct =
    analytics.totalRevenuePrev30dCents != null
      ? periodChangePct(analytics.totalRevenue30dCents, analytics.totalRevenuePrev30dCents)
      : null
  const showTrend = trendPct != null && trendPct !== 0
  const up = (trendPct ?? 0) > 0

  const riskTone: Tone = clawbackRiskCents <= 0 ? "good" : clawbackRiskCents > CLAWBACK_RISK_WARNING_CENTS ? "warn" : "neutral"
  const listingsSub =
    liveListings === 0 && draftListings === 0
      ? t("listingsNone")
      : draftListings > 0
        ? t("listingsDrafts", { count: draftListings })
        : t("listingsAllLive")

  return (
    <section aria-label={t("aria")} className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
      <Tile
        href="#analytics"
        Icon={TrendingUp}
        label={t("earnings")}
        value={money(analytics.totalRevenue30dCents)}
        sub={
          analytics.totalRevenue30dCents <= 0 ? (
            t("earningsNone")
          ) : showTrend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
              )}
            >
              {up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
              {t("trend", { pct: `${up ? "+" : ""}${trendPct}` })}
            </span>
          ) : (
            t("window")
          )
        }
      >
        <MiniSparkline values={series} id="aff-earnings" stroke="#7c3aed" className="hidden h-9 w-20 shrink-0 text-muted-foreground min-[420px]:block sm:w-24" />
      </Tile>

      <Tile
        href="/dashboard/affiliate/earnings"
        Icon={Landmark}
        label={t("payout")}
        value={money(analytics.estimatedPayoutJ7Cents)}
        sub={analytics.estimatedPayoutJ7Cents > 0 ? t("payoutSub") : t("payoutNone")}
      />

      <Tile
        href="/dashboard/affiliate/products"
        Icon={Store}
        label={t("listings")}
        value={t("listingsLive", { count: liveListings })}
        sub={listingsSub}
      />

      <Tile
        href="/dashboard/refunds"
        Icon={ShieldAlert}
        label={t("clawback")}
        value={money(clawbackRiskCents)}
        tone={riskTone}
        sub={clawbackRiskCents <= 0 ? t("clawbackNone") : clawbackRiskCents > CLAWBACK_RISK_WARNING_CENTS ? t("clawbackHigh") : t("clawbackSome")}
      />
    </section>
  )
}
