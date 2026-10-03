import { AlertTriangle, CheckCircle2, Gauge, PackageCheck, Truck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellEyebrow,
  missionControlAffisellSubtext,
  missionControlHeroCardDelayed,
  missionControlMetricIcon,
  missionControlMetricTile,
  missionControlMetricTileLabel,
  missionControlMetricTileValue,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import type { SupplierDeliveryInsight } from "@/lib/supplier-delivery-stats.server"
import { cn } from "@/lib/utils"

type Props = {
  insight: SupplierDeliveryInsight
  className?: string
}

function Tile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Truck }) {
  return (
    <div className={missionControlMetricTile}>
      <div className={missionControlMetricTileLabel}>
        <Icon className={cn("size-3 shrink-0", missionControlMetricIcon.brand)} aria-hidden />
        {label}
      </div>
      <p className={missionControlMetricTileValue}>{value}</p>
    </div>
  )
}

/**
 * Measured vs promised delivery, from carrier-attested deliveries. Buyers see the measured figures on product pages,
 * so the supplier gets to see — and fix — the gap first.
 */
export async function SupplierDeliveryPerformanceCard({ insight, className }: Props) {
  const t = await getTranslations("supplierDashboard.delivery")
  const { proven, comparison } = insight

  return (
    <section
      className={cn(missionControlHeroCardDelayed, "p-5", className)}
      aria-labelledby="supplier-delivery-title"
      data-testid="supplier-delivery-performance"
    >
      <p className={cn(missionControlAffisellEyebrow, "inline-flex items-center gap-1.5")}>
        <Gauge className="size-3 text-muted-foreground/70" aria-hidden />
        {t("title")}
      </p>
      <h2 id="supplier-delivery-title" className="sr-only">
        {t("title")}
      </h2>

      {!proven ? (
        <p className={cn("mt-2 max-w-md", missionControlAffisellSubtext)}>
          {t("notEnough", { count: insight.measuredOrders, min: insight.minForProven })}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {proven.medianDispatchDays != null ? (
              <Tile
                label={t("statDispatch")}
                value={t("days", { count: proven.medianDispatchDays })}
                icon={PackageCheck}
              />
            ) : null}
            <Tile label={t("statMedian")} value={t("days", { count: proven.medianEndToEndDays })} icon={Truck} />
            <Tile label={t("statP90")} value={t("days", { count: proven.p90EndToEndDays })} icon={Gauge} />
          </div>

          {comparison ? (
            comparison.optimistic ? (
              <p
                role="status"
                className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("optimistic", { declared: comparison.declaredTotalDays, p90: comparison.measuredP90Days })}
              </p>
            ) : (
              <p className="mt-3 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("honest", { declared: comparison.declaredTotalDays })}
              </p>
            )
          ) : null}

          <p className={cn("mt-3 text-xs", missionControlAffisellSubtext)}>
            {t("basis", { count: proven.sampleSize, window: insight.windowDays })}
          </p>
        </>
      )}
    </section>
  )
}
