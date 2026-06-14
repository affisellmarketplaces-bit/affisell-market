"use client"

import { Lock, Sparkles, Unlock, Wallet } from "lucide-react"

import {
  missionControlAffisellCard,
  missionControlAffisellEyebrow,
  missionControlAffisellOverlayIndigo,
  missionControlAffisellOverlayViolet,
  missionControlAffisellScanline,
  missionControlAffisellSubtext,
  missionControlHeading,
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
  accent: "brand" | "supplier" | "success"
}) {
  const accents = {
    brand:
      "border-brand/20 bg-brand-muted/50 text-brand dark:border-brand-light/15 dark:bg-brand-muted/30 dark:text-brand-light",
    supplier:
      "border-supplier/20 bg-supplier-muted/50 text-supplier dark:border-supplier-light/15 dark:bg-supplier-muted/30 dark:text-supplier-light",
    success:
      "border-emerald-200/80 bg-emerald-50/85 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/8 dark:text-emerald-100",
  }
  return (
    <div
      className={cn(
        "flex min-w-[7.5rem] flex-1 flex-col rounded-2xl border px-3 py-2.5 backdrop-blur-md",
        accents[accent]
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] opacity-80">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="text-lg font-bold tabular-nums tracking-tight">{value}</p>
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

  return (
    <section className={cn(missionControlAffisellCard, "p-5", className)} aria-labelledby="supplier-escrow-title">
      <div className={missionControlAffisellOverlayViolet} aria-hidden />
      <div className={missionControlAffisellOverlayIndigo} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(139,92,246,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.35)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-[0.03]"
        aria-hidden
      />
      <div className={missionControlAffisellScanline} aria-hidden />

      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn(missionControlAffisellEyebrow, "inline-flex items-center gap-1.5")}>
            <Sparkles className="size-3" aria-hidden />
            {copy.eyebrow}
          </p>
          <h2 id="supplier-escrow-title" className={cn("mt-1 text-base tracking-tight sm:text-lg", missionControlHeading)}>
            {copy.title}
          </h2>
          <p className={cn("mt-1 max-w-md", missionControlAffisellSubtext)}>{copy.hint}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-muted/45 px-2.5 py-1 text-[10px] font-semibold text-brand dark:border-brand-light/15 dark:bg-brand-muted/30 dark:text-brand-light">
          {summary.marginHeldCents + summary.upstreamReservedCents > 0 ? (
            <Lock className="size-3 text-brand dark:text-brand-light" aria-hidden />
          ) : (
            <Unlock className="size-3 text-emerald-600 dark:text-emerald-300" aria-hidden />
          )}
          {copy.orders}
        </div>
      </div>
      <div className="relative z-[1] mt-4 flex flex-wrap gap-2">
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
