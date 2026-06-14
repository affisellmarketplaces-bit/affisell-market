"use client"

import { Lock, Sparkles, Unlock, Wallet } from "lucide-react"

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
    brand: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    supplier: "border-indigo-400/20 bg-indigo-500/10 text-indigo-100",
    success: "border-emerald-400/20 bg-emerald-500/8 text-emerald-100",
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
      <p className="text-lg font-bold tabular-nums tracking-tight text-white">{value}</p>
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
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/95 p-5 text-white shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm",
        className
      )}
      aria-labelledby="supplier-escrow-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,rgba(109,40,217,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(79,70,229,0.08),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(167,139,250,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(167,139,250,0.35)_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/20 to-transparent"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/90">
            <Sparkles className="size-3" aria-hidden />
            {copy.eyebrow}
          </p>
          <h2 id="supplier-escrow-title" className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-300">{copy.hint}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-100">
          {summary.marginHeldCents + summary.upstreamReservedCents > 0 ? (
            <Lock className="size-3 text-violet-200" aria-hidden />
          ) : (
            <Unlock className="size-3 text-emerald-300" aria-hidden />
          )}
          {copy.orders}
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
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
