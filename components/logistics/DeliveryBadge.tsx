import {
  formatQuoteDeliveryCell,
  getDeliveryScore,
  type DeliverySlaColor,
} from "@/lib/logistics/delivery-sla"
import { cn } from "@/lib/utils"

const COLOR_CLASS: Record<DeliverySlaColor, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  orange: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-800",
}

type Props = {
  days: number
  country: string
  className?: string
  /** compact = short badge; full = quote-table style with SLA key */
  variant?: "compact" | "full"
}

/** Visual SLA badge — green boost / orange ok / red penalty. */
export function DeliveryBadge({ days, country, className, variant = "compact" }: Props) {
  const scored = getDeliveryScore(days, country)
  const text =
    variant === "full"
      ? formatQuoteDeliveryCell(days, country)
      : `${days}j ${scored.label}`

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-snug",
        COLOR_CLASS[scored.color],
        className
      )}
      title={formatQuoteDeliveryCell(days, country)}
    >
      {variant === "full" ? text : `${scored.emoji} ${text}`}
    </span>
  )
}
