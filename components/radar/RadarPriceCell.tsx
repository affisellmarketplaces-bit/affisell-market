"use client"

import {
  formatSupplierDemandSignal,
  canViewResellerMarketPrice,
  supplierDemandTooltip,
} from "@/lib/radar/radar-price-veil"
import { formatRadarPriceDisplay } from "@/lib/radar/format-radar-price"
import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"
import { cn } from "@/lib/utils"

type Props = {
  row: WorldRadarWinnerDto
  userRole?: string | null
  className?: string
}

/**
 * Reseller: market €. Supplier: demand signal veil (never invents a list price).
 */
export function RadarPriceCell({ row, userRole, className }: Props) {
  if (!canViewResellerMarketPrice(userRole) || row.priceVeiled) {
    return (
      <span
        className={cn(
          "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border border-violet-200/70 bg-gradient-to-r from-violet-50/90 via-white to-cyan-50/80 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-violet-900 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]",
          className
        )}
        title={supplierDemandTooltip({
          searches: row.searches,
          countryCode: row.countryCode,
        })}
      >
        <span
          className="inline-block size-1.5 shrink-0 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
          aria-hidden
        />
        <span className="truncate">{formatSupplierDemandSignal(row)}</span>
      </span>
    )
  }

  return (
    <span className={cn("tabular-nums font-medium text-zinc-900", className)}>
      {formatRadarPriceDisplay(row.price ?? 0, row.currency)}
    </span>
  )
}
