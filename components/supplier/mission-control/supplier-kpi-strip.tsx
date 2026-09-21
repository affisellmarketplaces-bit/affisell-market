import { getTranslations } from "next-intl/server"
import { ArrowDownRight, ArrowUpRight, Boxes, Landmark, PackageCheck, TrendingUp } from "lucide-react"

import { MiniSparkline } from "@/components/supplier/mission-control/mini-sparkline"
import { KpiTile as Tile, type KpiTone as Tone } from "@/components/dashboard/kpi-tile"
import { bcp47ForAppLocale, formatMoneyFromCents } from "@/lib/app-locale-format"
import type { AppLocale } from "@/lib/i18n-locale"
import type { SupplierDashboardAnalytics } from "@/lib/supplier-dashboard-analytics-types"
import type { SupplierMissionControlData } from "@/lib/supplier-mission-control"
import { periodChangePct } from "@/lib/analytics-compare"
import { cn } from "@/lib/utils"

/**
 * The four numbers a supplier checks first, above everything else: money in, orders to ship, next payout, catalogue.
 * Each tile opens the page where the number can be acted on. Tones (red / amber / green) carry the urgency.
 */
export async function SupplierKpiStrip({
  analytics,
  data,
  locale,
}: {
  analytics: SupplierDashboardAnalytics
  data: SupplierMissionControlData
  locale: AppLocale
}) {
  const t = await getTranslations("supplierDashboard.kpi")
  const money = (cents: number) => formatMoneyFromCents(cents, locale, { maximumFractionDigits: 0 })

  const series = analytics.dailyRevenue.map((d) => d.revenueCents)
  // Same 30-day window as the headline number, compared with the 30 days before it.
  const trendPct =
    analytics.totalRevenuePrev30dCents != null
      ? periodChangePct(analytics.totalRevenue30dCents, analytics.totalRevenuePrev30dCents)
      : null
  const showTrend = trendPct != null && trendPct !== 0
  const up = (trendPct ?? 0) > 0

  const u = data.urgent
  const shipTone: Tone = u.ordersToShip === 0 ? "good" : u.ordersToShipSlaLate ? "danger" : u.ordersToShipSlaUrgent ? "warn" : "neutral"
  const shipSub =
    u.ordersToShip === 0
      ? t("shipAllCaughtUp")
      : u.ordersToShipSlaLate
        ? u.ordersToShipPenaltyCents > 0
          ? t("shipLatePenalty", { amount: money(u.ordersToShipPenaltyCents) })
          : t("shipLate")
        : u.ordersToShipSlaUrgent
          ? t("shipUrgent")
          : t("shipWaiting")

  const payoutDate = analytics.estimatedNextPayoutDate
    ? new Intl.DateTimeFormat(bcp47ForAppLocale(locale), { day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${analytics.estimatedNextPayoutDate}T12:00:00Z`)
      )
    : null

  const catalogBits = [
    data.draftCount > 0 ? t("catalogDrafts", { count: data.draftCount }) : null,
    u.lowStockCount > 0 ? t("catalogLowStock", { count: u.lowStockCount }) : null,
  ].filter(Boolean)

  return (
    <section aria-label={t("aria")} className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
      <Tile
        href="#analytics"
        Icon={TrendingUp}
        label={t("revenue")}
        value={money(analytics.totalRevenue30dCents)}
        sub={
          analytics.totalRevenue30dCents <= 0 ? (
            t("revenueNone")
          ) : showTrend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
              )}
            >
              {up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
              {t("revenueTrend", { pct: `${up ? "+" : ""}${trendPct}` })}
            </span>
          ) : (
            t("revenueWindow")
          )
        }
      >
        <MiniSparkline values={series} id="revenue" className="hidden h-9 w-20 shrink-0 text-muted-foreground min-[420px]:block sm:w-24" />
      </Tile>

      <Tile
        href="/dashboard/supplier/orders"
        Icon={PackageCheck}
        label={t("ship")}
        value={String(u.ordersToShip)}
        tone={shipTone}
        sub={shipSub}
      />

      <Tile
        href="/dashboard/supplier/balance"
        Icon={Landmark}
        label={t("payout")}
        value={money(analytics.estimatedNextPayoutCents)}
        sub={payoutDate ? t("payoutOn", { date: payoutDate }) : t("payoutAfterDelivery")}
      />

      <Tile
        href="/dashboard/supplier/products"
        Icon={Boxes}
        label={t("catalog")}
        value={t("catalogLive", { count: data.productCount })}
        tone={u.lowStockCount > 0 ? "warn" : "neutral"}
        sub={catalogBits.length > 0 ? catalogBits.join(" · ") : t("catalogHealthy")}
      />
    </section>
  )
}
