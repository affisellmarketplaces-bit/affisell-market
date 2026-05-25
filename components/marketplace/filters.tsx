"use client"

import { Loader2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import {
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
} from "@/lib/affiliate-routes"
import type { MarketplaceFacet } from "@/lib/marketplace-facet-types"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Props = {
  categoryId: string | null
  subcategoryId?: string | null
  className?: string
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

export function MarketplaceFilters({ categoryId, subcategoryId, className }: Props) {
  const t = useTranslations("marketplace.browse")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const catalogBase = catalogBaseFromPath(pathname)
  const searchParams = useSearchParams()
  const scopeId = subcategoryId ?? categoryId

  const qs = facetParams(categoryId, subcategoryId)
  for (const [key, value] of searchParams.entries()) {
    if (key === "category" || key === "categoryId" || key === "subcategory" || key === "subcategoryId") {
      continue
    }
    qs.set(key, value)
  }

  const facetsUrl = scopeId ? `/api/marketplace/facets?${qs.toString()}` : null

  const { data, isLoading } = useSWR<MarketplaceFacet[] | { facets?: MarketplaceFacet[] }>(
    facetsUrl,
    fetcher,
    { keepPreviousData: true }
  )

  const facets: MarketplaceFacet[] = Array.isArray(data) ? data : Array.isArray(data?.facets) ? data.facets : []

  const toggleValue = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (next.get(key) === value) next.delete(key)
    else next.set(key, value)
    const s = next.toString()
    router.push(`${catalogBase}${s ? `?${s}` : ""}`)
  }

  if (!scopeId) {
    return (
      <aside
        className={cn(
          "rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
          className
        )}
      >
        {t("pickCategory")}
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        "w-full shrink-0 space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:w-52",
        className
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("filtersTitle")}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("filtersHint")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tAuth("loading")}
        </div>
      ) : facets.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("noFacets")}</p>
      ) : (
        facets.map((facet) => (
          <div key={facet.key}>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{facet.label}</p>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {facet.values.map((row) => {
                const checked = searchParams.get(facet.key) === row.value
                const inputId = `facet-${facet.key}-${row.value}`.replace(/[^a-zA-Z0-9_-]/g, "_")
                return (
                  <li key={`${facet.key}-${row.value}`}>
                    <label
                      htmlFor={inputId}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/80",
                        checked && "bg-violet-50 dark:bg-violet-950/40"
                      )}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                        checked={checked}
                        onChange={() => toggleValue(facet.key, row.value)}
                      />
                      <span className="min-w-0 flex-1 leading-snug text-zinc-700 dark:text-zinc-300">
                        {row.value}
                        <span className="text-zinc-400 dark:text-zinc-500"> ({row.count})</span>
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
