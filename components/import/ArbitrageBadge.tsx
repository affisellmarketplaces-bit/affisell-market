"use client"

import { formatEnrichEuro } from "@/lib/import/smart-import-enricher"
import { cn } from "@/lib/utils"

export type ArbitrageBadgeProps = {
  costPrice: number
  salePrice: number
  margin: number
  multiplier: number
  /** Optional 0–100 score shown in tooltip */
  score?: number
  className?: string
  /** Compact single-line vs stacked */
  size?: "sm" | "md"
  tooltip?: string
}

/**
 * Bloomberg-style arbitrage badge — green when margin% > 200, orange >100, red otherwise.
 */
export function ArbitrageBadge({
  costPrice,
  salePrice,
  margin,
  multiplier,
  score,
  className,
  size = "sm",
  tooltip,
}: ArbitrageBadgeProps) {
  const marginPercent = costPrice > 0 ? (margin / costPrice) * 100 : 0
  const tone =
    marginPercent > 200
      ? "bg-emerald-950 text-emerald-300 border-emerald-600/60"
      : marginPercent > 100
        ? "bg-amber-950 text-amber-200 border-amber-600/60"
        : "bg-red-950 text-red-300 border-red-600/60"

  const tip =
    tooltip ??
    `Acheté ${formatEnrichEuro(costPrice)}€ → Vendu ${formatEnrichEuro(salePrice)}€ = +${formatEnrichEuro(margin)}€${
      score != null ? ` | Score ${score}/100` : ""
    }`

  return (
    <span
      title={tip}
      className={cn(
        "inline-flex items-center gap-1 rounded border font-mono font-semibold tracking-tight shadow-sm",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        tone,
        className
      )}
    >
      <span aria-hidden>💰</span>
      <span>x{multiplier.toFixed(1)}</span>
      <span className="opacity-40">|</span>
      <span>+{formatEnrichEuro(margin)}€</span>
      <span className="opacity-40">|</span>
      <span>{Math.round(marginPercent)}% marge</span>
    </span>
  )
}

/** Compact green chip for catalog tables: x3.6 | +10,75€ */
export function ArbitrageBadgeCompact({
  multiplier,
  margin,
  tooltip,
  className,
}: {
  multiplier: number
  margin: number
  tooltip?: string
  className?: string
}) {
  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-emerald-600/50 bg-emerald-950 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300",
        className
      )}
    >
      x{multiplier.toFixed(1)} <span className="opacity-40">|</span> +{formatEnrichEuro(margin)}€
    </span>
  )
}
