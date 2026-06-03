"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import { ChevronDown, ChevronRight, Grid3x3, LayoutGrid, Loader2 } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Sub = { id: string; name: string; slug: string; count: number; fullPath?: string }
type Cat = {
  id: string
  name: string
  icon: string
  slug: string
  order: number
  count: number
  fullPath?: string
  subcategories: Sub[]
}

interface SidebarProps {
  onCategoryClick?: (catId: string, subId?: string) => void
  onShowFullCatalog?: () => void
  activeCategoryId?: string | null
  activeSubcategoryId?: string | null
  catalogTotal?: number
  categoriesPayload?: {
    categories: Cat[]
    catalogTotal?: number
    dbUnavailable?: boolean
    staticFallback?: boolean
    error?: string
  }
}

export function Sidebar({
  onCategoryClick,
  onShowFullCatalog,
  activeCategoryId,
  activeSubcategoryId,
  catalogTotal,
  categoriesPayload,
}: SidebarProps) {
  const t = useTranslations("marketplace.sidebar")
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const { data: swrData, isLoading } = useSWR<{
    categories: Cat[]
    catalogTotal?: number
    dbUnavailable?: boolean
    staticFallback?: boolean
    error?: string
  }>(categoriesPayload ? null : "/api/categories", () => fetcher("/api/categories"), {
    fallbackData: categoriesPayload,
    refreshInterval: (latest) => (latest?.dbUnavailable ? 0 : 300_000),
    revalidateOnMount: !categoriesPayload,
  })

  const data = categoriesPayload ?? swrData

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  if (!categoriesPayload && isLoading) {
    return (
      <aside className="flex h-[min(24rem,50vh)] w-full shrink-0 items-center justify-center self-start rounded-2xl border border-border bg-card lg:h-[calc(100vh-5.25rem)] lg:w-full lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0 lg:sticky lg:top-[5.25rem]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </aside>
    )
  }

  if (!data?.categories?.length && data?.dbUnavailable) {
    return (
      <aside className="h-[min(24rem,50vh)] w-full shrink-0 rounded-2xl border border-border bg-card p-4 lg:h-[calc(100vh-5.25rem)] lg:w-full lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("unavailable")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{data.error}</p>
      </aside>
    )
  }

  if (!data?.categories?.length) {
    return (
      <aside className="h-[min(24rem,50vh)] w-full shrink-0 rounded-2xl border border-border bg-card p-4 lg:h-[calc(100vh-5.25rem)] lg:w-full lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </aside>
    )
  }

  return (
    <aside className="flex h-[min(28rem,55vh)] w-full shrink-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card lg:sticky lg:top-[5.25rem] lg:h-[calc(100vh-5.25rem)] lg:w-full lg:max-h-none lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0">
      <div className={cn("sticky top-0 z-10 px-4 py-4", affisellBrand.gradientBar)}>
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white drop-shadow-sm">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          {t("title")}
        </h2>
        <p className="mt-1 text-[11px] font-medium text-white/80">
          {data.staticFallback ? t("offlineHint") : t("subtitle")}
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => onShowFullCatalog?.()}
          className={cn(
            "flex w-full items-center gap-2 border-b border-border/80 px-4 py-3 text-left text-sm font-semibold transition",
            !activeCategoryId && !activeSubcategoryId
              ? "bg-violet-600/10 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
              : "text-zinc-700 hover:bg-muted/60 dark:text-zinc-200"
          )}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{t("allCatalog")}</span>
          {(catalogTotal ?? data.catalogTotal ?? 0) > 0 ? (
            <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:text-violet-200">
              {catalogTotal ?? data.catalogTotal}
            </span>
          ) : null}
        </button>
        {data.categories.map((cat) => {
          const parentActive = activeCategoryId === cat.id && !activeSubcategoryId
          const expanded = expandedCats.includes(cat.id)
          return (
            <div key={cat.id} className="border-b border-border/80">
              <button
                type="button"
                title={cat.fullPath ?? cat.name}
                onClick={() => {
                  toggleCategory(cat.id)
                  onCategoryClick?.(cat.id)
                }}
                className={cn(
                  "group flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                  parentActive
                    ? "bg-buyer-muted/80 text-orange-950 dark:bg-buyer-muted dark:text-buyer-light"
                    : cat.count === 0
                      ? "text-zinc-500 hover:bg-muted/50 dark:text-zinc-500"
                      : "text-zinc-900 hover:bg-muted/80 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CategoryGlyph name={cat.name} slug={cat.slug} fullPath={cat.fullPath} icon={cat.icon} size="sm" />
                  <span className="font-semibold">{cat.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {cat.count > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        parentActive ? "bg-buyer/15 text-buyer" : "text-zinc-500 dark:text-zinc-400"
                      )}
                    >
                      {cat.count}
                    </span>
                  ) : null}
                  {expanded ? (
                    <ChevronDown
                      className={cn("h-4 w-4", parentActive ? "text-buyer" : "text-zinc-400 dark:text-zinc-500")}
                    />
                  ) : (
                    <ChevronRight
                      className={cn("h-4 w-4", parentActive ? "text-buyer" : "text-zinc-400 dark:text-zinc-500")}
                    />
                  )}
                </span>
              </button>

              {expanded &&
                cat.subcategories?.map((sub) => {
                  const subActive = activeSubcategoryId === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      title={sub.fullPath ?? `${cat.name} > ${sub.name}`}
                      onClick={() => onCategoryClick?.(cat.id, sub.id)}
                      className={cn(
                        "flex w-full flex-col items-stretch border-l-2 py-2 pl-11 pr-4 text-left text-sm transition",
                        subActive
                          ? "border-buyer bg-buyer-muted/70 font-medium text-orange-950 dark:border-buyer dark:bg-buyer-muted dark:text-buyer-light"
                          : "border-transparent text-zinc-600 hover:border-brand/30 hover:bg-brand-muted/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      )}
                    >
                      <span className="min-w-0 truncate">{sub.name}</span>
                      {sub.fullPath ? (
                        <span className="mt-0.5 line-clamp-2 text-[10px] font-normal leading-snug text-zinc-500 dark:text-zinc-500">
                          {sub.fullPath}
                        </span>
                      ) : null}
                      {sub.count > 0 ? (
                        <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-[10px] font-bold text-brand">
                          {sub.count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
