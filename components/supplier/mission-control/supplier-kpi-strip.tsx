import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowDownRight, ArrowUpRight, Boxes, Landmark, PackageCheck, TrendingUp, type LucideIcon } from "lucide-react"

import { MiniSparkline } from "@/components/supplier/mission-control/mini-sparkline"
import { missionControlPanel } from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { bcp47ForAppLocale, formatMoneyFromCents } from "@/lib/app-locale-format"
import type { AppLocale } from "@/lib/i18n-locale"
import type { SupplierDashboardAnalytics } from "@/lib/supplier-dashboard-analytics-types"
import type { SupplierMissionControlData } from "@/lib/supplier-mission-control"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "good" | "warn" | "danger"

const TONE: Record<Tone, string> = {
  neutral: "",
  good: "ring-1 ring-emerald-300/60 dark:ring-emerald-800/60",
  warn: "ring-1 ring-amber-300/80 dark:ring-amber-800/70",
  danger: "ring-2 ring-red-400/70 dark:ring-red-800/70",
}

function Tile({
  href,
  Icon,
  label,
  value,
  sub,
  tone = "neutral",
  children,
}: {
  href: string
  Icon: LucideIcon
  label: string
  value: string
  sub?: React.ReactNode
  tone?: Tone
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        missionControlPanel,
        "group flex min-w-0 flex-col justify-between gap-2 p-3 transition sm:gap-3 sm:p-4 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        TONE[tone]
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-2 sm:text-[11px] sm:tracking-wider">
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            tone === "danger" && "text-red-600 dark:text-red-400",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "good" && "text-emerald-600 dark:text-emerald-400"
          )}
          aria-hidden
        />
        <span className="line-clamp-1">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl",
              tone === "danger" && "text-red-700 dark:text-red-300"
            )}
          >
            {value}
          </p>
          {sub ? <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{sub}</p> : null}
        </div>
        {children}
      </div>
    </Link>
  )
}

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
  const delta = data.metrics7d.supplierNetCents
  const showTrend = data.metrics7d.hasPriorPeriodData && delta.pctChange != null && delta.pctChange !== 0
  const up = (delta.pctChange ?? 0) > 0

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
              {t("revenueTrend", { pct: `${up ? "+" : ""}${delta.pctChange}` })}
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
