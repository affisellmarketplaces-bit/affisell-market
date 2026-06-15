"use client"

import useSWR from "swr"

import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

type GraduatedCountriesResponse = {
  countries: Array<{ countryIso2: string; shipsToValue: string }>
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<GraduatedCountriesResponse>

type Props = {
  inSheet?: boolean
  onToggleShipsTo: (value: string) => void
}

/** Sidebar chips for graduated checkout countries (shipsTo filter). */
export function GraduatedCountriesFilterSection({ inSheet = false, onToggleShipsTo }: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.browse")
  const searchParams = useSearchParams()
  const { data } = useSWR<GraduatedCountriesResponse>("/api/market/graduated-countries", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  })

  const countries = data?.countries ?? []
  if (countries.length === 0) return null

  const activeShipsTo = searchParams.get("shipsTo")?.toUpperCase() ?? null

  return (
    <div>
      <p
        className={cn(
          "text-xs font-semibold",
          inSheet ? "text-violet-200" : "text-zinc-800 dark:text-zinc-200"
        )}
      >
        {t("graduatedCountriesTitle")}
      </p>
      <p className={cn("mt-0.5 text-[11px] leading-snug", inSheet ? "text-zinc-400" : "text-zinc-500")}>
        {t("graduatedCountriesHint")}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {countries.map((row) => {
          const active = activeShipsTo === row.countryIso2
          const label = visitorCountryDisplayName(row.countryIso2, locale)
          return (
            <li key={row.countryIso2}>
              <button
                type="button"
                onClick={() => onToggleShipsTo(row.shipsToValue)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  active
                    ? "bg-violet-600 text-white"
                    : inSheet
                      ? "bg-white/10 text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
                      : "bg-violet-50 text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800"
                )}
              >
                {t("graduatedCountryShipsTo", { country: label })}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
