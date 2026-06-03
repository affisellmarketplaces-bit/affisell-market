"use client"

import { Loader2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import {
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
} from "@/lib/affiliate-routes"
import { DISCOVERY_FACET_KEYS } from "@/lib/marketplace-discovery-facets-shared"
import type { MarketplaceFacet } from "@/lib/marketplace-facet-types"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Props = {
  categoryId: string | null
  subcategoryId?: string | null
  departmentNames?: Record<string, string>
  className?: string
  inSheet?: boolean
}

const PRICE_LABELS: Record<string, { fr: string; en: string }> = {
  under25: { fr: "Moins de 25 €", en: "Under €25" },
  "25-100": { fr: "25 – 100 €", en: "€25 – €100" },
  over100: { fr: "Plus de 100 €", en: "Over €100" },
}

const SHIP_LABELS: Record<string, { fr: string; en: string }> = {
  fr: { fr: "France", en: "France" },
  eu: { fr: "Union européenne", en: "European Union" },
}

const DELIVERY_LABELS: Record<string, { fr: string; en: string }> = {
  under3: { fr: "≤ 3 jours", en: "≤ 3 days" },
  under7: { fr: "≤ 7 jours", en: "≤ 7 days" },
}

function facetParams(categoryId: string | null, subcategoryId: string | null | undefined) {
  const sp = new URLSearchParams()
  if (subcategoryId) sp.set("subcategoryId", subcategoryId)
  else if (categoryId) sp.set("categoryId", categoryId)
  return sp
}

function catalogBaseFromPath(pathname: string): string {
  if (pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`)) {
    return AFFILIATE_CATALOG_PATH
  }
  return PUBLIC_MARKETPLACE_BROWSE_PATH
}

export function MarketplaceFilters({
  categoryId,
  subcategoryId,
  departmentNames,
  className,
  inSheet = false,
}: Props) {
  const t = useTranslations("marketplace.browse")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const catalogBase = catalogBaseFromPath(pathname)
  const searchParams = useSearchParams()
  const deptParam = searchParams.get("dept")
  const scopeId = subcategoryId ?? categoryId ?? deptParam

  const qs = facetParams(categoryId, subcategoryId)
  for (const [key, value] of searchParams.entries()) {
    if (key === "category" || key === "categoryId" || key === "subcategory" || key === "subcategoryId") {
      continue
    }
    qs.set(key, value)
  }

  const facetsUrl = `/api/marketplace/facets?${qs.toString()}`

  const { data, isLoading } = useSWR<MarketplaceFacet[] | { facets?: MarketplaceFacet[] }>(
    facetsUrl,
    fetcher,
    { keepPreviousData: true }
  )

  const facets: MarketplaceFacet[] = Array.isArray(data) ? data : Array.isArray(data?.facets) ? data.facets : []

  const toggleValue = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (next.get(key) === value) {
      next.delete(key)
    } else {
      next.set(key, value)
      if (key === "dept") {
        next.delete("category")
        next.delete("subcategory")
        next.delete("categoryId")
        next.delete("subcategoryId")
      }
    }
    const s = next.toString()
    router.push(`${catalogBase}${s ? `?${s}` : ""}`)
  }

  function facetValueLabel(facetKey: string, value: string): string {
    if (facetKey === "dept" && departmentNames?.[value]) return departmentNames[value]!
    if (facetKey === "price") {
      const row = PRICE_LABELS[value]
      if (row) return row.fr
    }
    if (facetKey === "shipsFrom") {
      const row = SHIP_LABELS[value]
      if (row) return row.fr
    }
    if (facetKey === "delivery") {
      const row = DELIVERY_LABELS[value]
      if (row) return row.fr
    }
    if (facetKey === "freeShipping" && value === "1") return t("freeShippingFacet")
    return value
  }

  return (
    <aside
      className={cn(
        "w-full shrink-0 space-y-5 rounded-2xl border p-4 lg:w-52",
        inSheet
          ? "border-0 bg-transparent text-zinc-100"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      {!inSheet ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("filtersTitle")}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("filtersHint")}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className={cn("flex items-center gap-2 text-sm", inSheet ? "text-zinc-400" : "text-zinc-500")}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tAuth("loading")}
        </div>
      ) : facets.length === 0 ? (
        <p className={cn("text-xs", inSheet ? "text-zinc-400" : "text-zinc-500 dark:text-zinc-400")}>{t("noFacets")}</p>
      ) : (
        facets.map((facet) => (
          <div key={facet.key}>
            <p className={cn("text-xs font-semibold", inSheet ? "text-violet-200" : "text-zinc-800 dark:text-zinc-200")}>
              {facet.label}
            </p>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {facet.values.map((row) => {
                const checked = searchParams.get(facet.key) === row.value
                const inputId = `facet-${facet.key}-${row.value}`.replace(/[^a-zA-Z0-9_-]/g, "_")
                return (
                  <li key={`${facet.key}-${row.value}`}>
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-sm transition",
                        inSheet
                          ? checked
                            ? "bg-violet-500/20"
                            : "hover:bg-white/[0.04]"
                          : checked
                            ? "bg-violet-50 dark:bg-violet-950/40"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                      )}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                        checked={checked}
                        onChange={() => toggleValue(facet.key, row.value)}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 leading-snug",
                          inSheet ? "text-zinc-200" : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        {DISCOVERY_FACET_KEYS.has(facet.key)
                          ? facetValueLabel(facet.key, row.value)
                          : row.value}
                        <span className={inSheet ? "text-zinc-500" : "text-zinc-400 dark:text-zinc-500"}>
                          {" "}
                          ({row.count})
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </aside>
  )
}
