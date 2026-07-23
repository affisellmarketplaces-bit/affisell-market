"use client"

import { computeNetProfit, formatProfitEuro } from "@/lib/profit/profit-presets"
import { cn } from "@/lib/utils"

type Props = {
  cost: number
  salePrice: number
  shippingCost?: number
  className?: string
}

/** Compact net-profit chip for cards / grids. */
export function ProfitBadge({ cost, salePrice, shippingCost = 0, className }: Props) {
  if (!Number.isFinite(cost) || !Number.isFinite(salePrice) || salePrice <= 0) return null

  const { profit, tone } = computeNetProfit({ cost, salePrice, shippingCost })
  const toneClass =
    tone === "green"
      ? "border-emerald-300/50 bg-emerald-500/15 text-emerald-100"
      : tone === "yellow"
        ? "border-amber-300/50 bg-amber-500/15 text-amber-100"
        : "border-rose-300/50 bg-rose-500/15 text-rose-100"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums backdrop-blur-sm",
        toneClass,
        className
      )}
      title="Bénéfice net estimé (coût + frais 2% + pub 8€)"
    >
      {formatProfitEuro(profit)} net
    </span>
  )
}
