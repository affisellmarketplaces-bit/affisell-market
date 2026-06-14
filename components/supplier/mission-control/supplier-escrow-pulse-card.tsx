"use client"

import { Lock, Sparkles, Unlock, Wallet } from "lucide-react"

import {
  missionControlHeroCardDelayed,
  missionControlAffisellEyebrow,
  missionControlAffisellOverlayIndigo,
  missionControlAffisellOverlayViolet,
  missionControlAffisellScanline,
  missionControlAffisellSubtext,
  missionControlHeading,
  missionControlMetricIcon,
  missionControlMetricTile,
  missionControlMetricTileLabel,
  missionControlMetricTileValue,
  missionControlStatusPill,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import type { SupplierEscrowSummary } from "@/lib/supplier-escrow-shared"
import { formatEscrowMetric } from "@/lib/supplier-escrow-shared"
import { cn } from "@/lib/utils"

type Props = {
  summary: SupplierEscrowSummary
  locale?: "fr" | "en"
  className?: string
}

function MetricTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: typeof Wallet
  accent: keyof typeof missionControlMetricIcon
}) {
  return (
    <div className={missionControlMetricTile}>
      <div className={missionControlMetricTileLabel}>
        <Icon className={cn("size-3 shrink-0", missionControlMetricIcon[accent])} aria-hidden />
        {label}
      </div>
      <p className={missionControlMetricTileValue}>{value}</p>
    </div>
  )
}

/** Supplier escrow cockpit — upstream COGS pool + margin held until ship/confirm. */
export function SupplierEscrowPulseCard({ summary, locale = "fr", className }: Props) {
  const copy =
    locale === "fr"
      ? {
          eyebrow: "Escrow AutoBuy",
          title: "Capital client · sécurisé",
          upstream: "COGS upstream",
          held: "Marge bloquée",
          released: "Libéré 30j",
          hint:
            summary.autoBuyActive
              ? "L’argent client finance vos achats fournisseurs — la marge se libère après expédition."
              : "Activez AutoBuy sur vos fiches pour financer vos sources sans avancer de trésorerie.",
          orders: `${summary.ordersInEscrow} commande${summary.ordersInEscrow > 1 ? "s" : ""} en cours`,
        }
      : {
          eyebrow: "AutoBuy Escrow",
          title: "Customer cash · secured",
          upstream: "Upstream COGS",
          held: "Margin held",
          released: "Released 30d",
          hint: summary.autoBuyActive
            ? "Customer funds pay your suppliers — margin releases after shipment."
            : "Enable AutoBuy on listings to fund upstream orders without float.",
          orders: `${summary.ordersInEscrow} order${summary.ordersInEscrow === 1 ? "" : "s"} in flight`,
        }

  const hasHeldFunds = summary.marginHeldCents + summary.upstreamReservedCents > 0

  return (
    <section className={cn(missionControlHeroCardDelayed, "p-5", className)} aria-labelledby="supplier-escrow-title">
      <div className={missionControlAffisellOverlayViolet} aria-hidden />
      <div className={missionControlAffisellOverlayIndigo} aria-hidden />
      <div className={missionControlAffisellScanline} aria-hidden />

      <div className="relative z-[3] flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn(missionControlAffisellEyebrow, "inline-flex items-center gap-1.5")}>
            <Sparkles className="size-3 text-muted-foreground/70" aria-hidden />
            {copy.eyebrow}
          </p>
          <h2 id="supplier-escrow-title" className={cn("mt-1 text-base tracking-tight sm:text-lg", missionControlHeading)}>
            {copy.title}
          </h2>
          <p className={cn("mt-1 max-w-md", missionControlAffisellSubtext)}>{copy.hint}</p>
        </div>
        <div className={missionControlStatusPill}>
          {hasHeldFunds ? (
            <Lock className="size-3 text-muted-foreground" aria-hidden />
          ) : (
            <Unlock className={cn("size-3", missionControlMetricIcon.success)} aria-hidden />
          )}
          {copy.orders}
        </div>
      </div>
      <div className="relative z-[3] mt-4 flex flex-wrap gap-2">
        <MetricTile
          label={copy.upstream}
          value={formatEscrowMetric(summary.upstreamReservedCents)}
          icon={Wallet}
          accent="brand"
        />
        <MetricTile
          label={copy.held}
          value={formatEscrowMetric(summary.marginHeldCents)}
          icon={Lock}
          accent="supplier"
        />
        <MetricTile
          label={copy.released}
          value={formatEscrowMetric(summary.marginReleasedCents)}
          icon={Unlock}
          accent="success"
        />
      </div>
    </section>
  )
}
