import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { ArrowLeft, CalendarCheck2, Clock, PackageCheck } from "lucide-react"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ShipPulsePolicyBanner } from "@/components/supplier/ship-pulse-policy-banner"
import { SupplierFulfillmentGroupsBoundary } from "@/components/supplier/supplier-fulfillment-groups-boundary"
import { SupplierFulfillmentGroupsPanel } from "@/components/supplier/supplier-fulfillment-groups-panel"
import { SupplierOrdersPanel } from "@/components/supplier/supplier-orders-panel"
import { loadSupplierOrdersOverview } from "@/lib/supplier-orders-payload"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierOrdersPage() {
  const session = await requireSupplierSession("/dashboard/supplier/orders")
  const t = await getTranslations("supplierOrders.page")

  const overview = await loadSupplierOrdersOverview(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-6">
        <div>
          <Link
            href="/dashboard/supplier"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
                {t("eyebrow")}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                {t("title")}
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{t("description")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div
            className={cn(
              "rounded-2xl border p-3.5 shadow-sm sm:p-4",
              overview.toShip > 0
                ? "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
                : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950/60"
            )}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-300/90 sm:text-[11px]">
              <PackageCheck className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t("statToShip")}</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              {overview.toShip}
            </p>
          </div>
          <div
            className={cn(
              "rounded-2xl border p-3.5 shadow-sm sm:p-4",
              overview.overdue > 0
                ? "border-red-300/80 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20"
                : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950/60"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]",
                overview.overdue > 0
                  ? "text-red-800/90 dark:text-red-300/90"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t("statOverdue")}</span>
            </div>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
                overview.overdue > 0 ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50"
              )}
            >
              {overview.overdue}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-400/90 sm:text-[11px]">
              <CalendarCheck2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t("statShippedToday")}</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              {overview.shippedToday}
            </p>
          </div>
        </div>

        <ShipPulsePolicyBanner />

        <SupplierFulfillmentGroupsBoundary>
          <SupplierFulfillmentGroupsPanel />
        </SupplierFulfillmentGroupsBoundary>

        <SupplierOrdersPanel />
      </BentoContainer>
    </BentoShell>
  )
}
