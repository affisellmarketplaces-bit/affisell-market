"use client"

import Image from "next/image"
import { Check, Sparkles, Store, TrendingUp, Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { AffiliateCatalogEconomicsPanel } from "@/components/affiliate/affiliate-catalog-economics-panel"
import type { AffiliateCatalogHighlightCard, AffiliateCatalogHighlights } from "@/lib/affiliate-catalog-types"
import { buildAffiliateCatalogCardEconomicsFromProduct } from "@/lib/affiliate-catalog-margin-display"
import { cn } from "@/lib/utils"

type TabId = "bestsellers" | "new" | "margin"

const TABS: { id: TabId; label: "tabBest" | "tabNew" | "tabMargin"; icon: typeof TrendingUp }[] = [
  { id: "bestsellers", label: "tabBest", icon: TrendingUp },
  { id: "new", label: "tabNew", icon: Sparkles },
  { id: "margin", label: "tabMargin", icon: Zap },
]

type Props = {
  initial: AffiliateCatalogHighlights
  onPickProduct: (productId: string, listingId: string | null) => void
}

function itemsForTab(tab: TabId, data: AffiliateCatalogHighlights): AffiliateCatalogHighlightCard[] {
  if (tab === "bestsellers") return data.bestSellers7d
  if (tab === "new") return data.newArrivals
  return data.highMargin
}

export function AffiliateCatalogHighlights({ initial, onPickProduct }: Props) {
  const router = useRouter()
  const t = useTranslations("affiliate.catalogLive")
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabId>("bestsellers")
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)

  const filterKey = searchParams.toString()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filterKey ? `?${filterKey}` : ""
      const res = await fetch(`/api/affiliate/catalog-highlights${qs}`, { credentials: "include" })
      const json = (await res.json()) as AffiliateCatalogHighlights
      if (res.ok) setData(json)
    } catch {
      /* keep previous */
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const items = useMemo(() => itemsForTab(tab, data), [tab, data])

  function selectTab(next: TabId) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("highlight", next)
    const s = params.toString()
    router.replace(s ? `?${s}` : "", { scroll: false })
  }

  return (
    <section id="catalog-highlights" aria-labelledby="affiliate-highlights-heading" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Highlights
          </p>
          <h2
            id="affiliate-highlights-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl"
          >
            {t("featuredTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("featuredSub")}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-1 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/50"
          role="tablist"
          aria-label={t("trendsAria")}
        >
          {TABS.map((tabDef) => {
            const Icon = tabDef.icon
            return (
              <button
                key={tabDef.id}
                type="button"
                role="tab"
                aria-selected={tab === tabDef.id}
                onClick={() => selectTab(tabDef.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm",
                  tab === tabDef.id
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-100"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                {t(tabDef.label)}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/40 px-6 py-10 text-center text-sm text-zinc-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-zinc-400">
          {t("noItems")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <li key={`${tab}-${item.productId}`}>
              <button
                type="button"
                onClick={() => onPickProduct(item.productId, item.listingId)}
                className={cn(
                  "group flex h-full w-full flex-col overflow-hidden rounded-3xl border text-left transition",
                  "border-zinc-100/90 bg-white/90 shadow-sm hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10",
                  "dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-violet-700",
                  item.isInStore && "ring-2 ring-emerald-500/30"
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-violet-50/50 to-teal-50/30 dark:from-violet-950/30 dark:to-teal-950/20">
                  {item.isInStore ? (
                    <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      <Check className="h-3 w-3" aria-hidden />
                      {t("inShowcase")}
                    </span>
                  ) : (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      {t("addToShowcase")}
                    </span>
                  )}
                  <Image
                    src={item.imageUrl || "/placeholder-product.jpg"}
                    alt=""
                    fill
                    className="object-contain p-3 transition duration-300 group-hover:scale-105"
                    sizes="(max-width:640px) 50vw, 200px"
                    unoptimized={Boolean(item.imageUrl?.startsWith("http"))}
                  />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {item.name}
                  </p>
                  <AffiliateCatalogEconomicsPanel
                    economics={buildAffiliateCatalogCardEconomicsFromProduct({
                      basePriceCents: item.basePriceCents,
                      commissionRate: item.commissionRate,
                    })}
                    variant="compact"
                    className="mt-2"
                  />
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {item.soldCount > 0 ? (
                      <li>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          {t("sold", { count: item.soldCount })}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                  <p className="mt-2 flex items-center gap-1 truncate text-[10px] text-zinc-500">
                    <Store className="h-3 w-3 shrink-0" aria-hidden />
                    {item.supplierLabel}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
