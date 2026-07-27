import {
  formatQuoteDeliveryCell,
  getDeliveryScore,
  getDeliveryScoreForCountries,
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
  /** Legacy single market — use countries when several destinations. */
  country?: string
  countries?: readonly string[]
  className?: string
  /** compact = short badge; full = quote-table style with SLA key */
  variant?: "compact" | "full"
}

function resolveDeliveryCountries(args: {
  country?: string
  countries?: readonly string[]
}): string[] {
  if (args.countries && args.countries.length > 0) return [...args.countries]
  if (args.country?.trim()) return [args.country.trim().toUpperCase()]
  return ["FR"]
}

/** Visual SLA badge — green boost / orange ok / red penalty. */
export function DeliveryBadge({ days, country, countries, className, variant = "compact" }: Props) {
  const marketCodes = resolveDeliveryCountries({ country, countries })
  const scored =
    marketCodes.length > 1
      ? getDeliveryScoreForCountries(days, marketCodes)
      : getDeliveryScore(days, marketCodes[0] ?? "FR")
  const primaryCountry = marketCodes[0] ?? "FR"
  const text =
    variant === "full"
      ? marketCodes.length > 1
        ? `${formatQuoteDeliveryCell(days, primaryCountry)} · ${marketCodes.join(", ")}`
        : formatQuoteDeliveryCell(days, primaryCountry)
      : `${days}j ${scored.label}`

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-snug",
        COLOR_CLASS[scored.color],
        className
      )}
      title={
        marketCodes.length > 1
          ? `${formatQuoteDeliveryCell(days, primaryCountry)} (${marketCodes.join(", ")})`
          : formatQuoteDeliveryCell(days, primaryCountry)
      }
    >
      {variant === "full" ? text : `${scored.emoji} ${text}`}
    </span>
  )
}
