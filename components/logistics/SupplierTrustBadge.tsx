import {
  formatTrustTooltip,
  getSupplierBadge,
  type SupplierBadge,
} from "@/lib/logistics/supplier-score"
import { cn } from "@/lib/utils"

const COLOR_CLASS: Record<SupplierBadge["color"], string> = {
  gold: "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-950 ring-1 ring-amber-200",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  gray: "border-zinc-200 bg-zinc-50 text-zinc-700",
  orange: "border-orange-200 bg-orange-50 text-orange-900",
  red: "border-red-200 bg-red-50 text-red-800",
}

type Props = {
  trustScore: number
  className?: string
  showScore?: boolean
  tooltip?: string
  totalOrders?: number
  onTimeDeliveries?: number
  promisedVsActualDelta?: number
}

export function SupplierTrustBadge({
  trustScore,
  className,
  showScore = true,
  tooltip,
  totalOrders,
  onTimeDeliveries,
  promisedVsActualDelta,
}: Props) {
  const badge = getSupplierBadge(trustScore)
  const title =
    tooltip ??
    (totalOrders != null && onTimeDeliveries != null && promisedVsActualDelta != null
      ? formatTrustTooltip({
          trustScore,
          totalOrders,
          onTimeDeliveries,
          promisedVsActualDelta,
        })
      : `${badge.label} — boost ${badge.boost > 0 ? "+" : ""}${badge.boost}%`)

  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-snug",
        COLOR_CLASS[badge.color],
        badge.tier === "top" && "shadow-sm",
        badge.tier === "avoid" && "opacity-80",
        className
      )}
    >
      {showScore ? `${badge.label} ${trustScore}/100` : badge.label}
    </span>
  )
}
