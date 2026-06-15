"use client"

import { Package } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  basePath?: string
}

/** Quick filter: listings shippable to the visitor's checkout country. */
export function MarketplaceShipsToChip({ className, basePath = "/marketplace" }: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.browse")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { country, checkoutAvailable, loading } = useVisitorCheckoutRegion()

  if (loading || !country || !checkoutAvailable) return null

  const active = searchParams.get("shipsTo")?.toUpperCase() === country
  const countryName = visitorCountryDisplayName(country, locale)

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    if (active) {
      params.delete("shipsTo")
    } else {
      params.set("shipsTo", country.toLowerCase())
    }
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-violet-50 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800",
        className
      )}
    >
      <Package className="size-3.5 shrink-0" aria-hidden />
      {active ? t("shipsToActive", { country: countryName }) : t("shipsToChip", { country: countryName })}
    </button>
  )
}
