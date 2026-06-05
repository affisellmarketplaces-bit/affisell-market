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
  accent: "cyan" | "violet" | "emerald"
}) {
  const accents = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    violet: "border-violet-400/25 bg-violet-500/10 text-violet-100",
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
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
        "relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#050816] via-[#0f172a] to-[#1e1b4b] p-5 text-white shadow-xl shadow-cyan-950/30",
        className
      )}
      aria-labelledby="supplier-escrow-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_0%,rgba(34,211,238,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">
            <Sparkles className="size-3" aria-hidden />
            {copy.eyebrow}
          </p>
          <h2 id="supplier-escrow-title" className="mt-1 text-xl font-bold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-300/90">{copy.hint}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
          {summary.marginHeldCents + summary.upstreamReservedCents > 0 ? (
            <Lock className="size-3 text-amber-300" aria-hidden />
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
          accent="cyan"
        />
        <MetricTile
          label={copy.held}
          value={formatEscrowMetric(summary.marginHeldCents)}
          icon={Lock}
          accent="violet"
        />
        <MetricTile
          label={copy.released}
          value={formatEscrowMetric(summary.marginReleasedCents)}
          icon={Unlock}
          accent="emerald"
        />
      </div>
    </section>
  )
}
