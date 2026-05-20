"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { ChevronDown, ChevronRight, Grid3x3, Loader2 } from "lucide-react"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Sub = { id: string; name: string; slug: string; count: number }
type Cat = {
  id: string
  name: string
  icon: string
  slug: string
  order: number
  count: number
  subcategories: Sub[]
}

interface SidebarProps {
  onCategoryClick?: (catId: string, subId?: string) => void
  activeCategoryId?: string | null
  activeSubcategoryId?: string | null
}

export function Sidebar({ onCategoryClick, activeCategoryId, activeSubcategoryId }: SidebarProps) {
  const locale = useLocale()
  const t = useTranslations("marketplace.sidebar")
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const { data, isLoading } = useSWR<{
    categories: Cat[]
    dbUnavailable?: boolean
    staticFallback?: boolean
    error?: string
  }>(["/api/categories", locale], () => fetcher("/api/categories"), {
    refreshInterval: (latest) => (latest?.dbUnavailable ? 0 : 300_000),
  })

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  if (isLoading) {
    return (
      <aside className="flex h-[calc(100vh-80px)] w-[19rem] shrink-0 items-center justify-center self-start border-r border-border bg-card lg:sticky lg:top-[5.25rem]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </aside>
    )
  }

  if (!data?.categories?.length && data?.dbUnavailable) {
    return (
      <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 border-r border-border bg-card p-4 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("unavailable")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{data.error}</p>
      </aside>
    )
  }

  if (!data?.categories?.length) {
    return (
      <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 border-r border-border bg-card p-4 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm text-muted-foreground">No categories</p>
      </aside>
    )
  }

  return (
    <aside className="sticky top-[5.25rem] flex h-[calc(100vh-80px)] w-[19rem] shrink-0 flex-col self-start overflow-y-auto border-r border-border bg-card lg:top-[5.25rem]">
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
        {data.categories.map((cat) => {
          const parentActive = activeCategoryId === cat.id && !activeSubcategoryId
          const expanded = expandedCats.includes(cat.id)
          return (
            <div key={cat.id} className="border-b border-border/80">
              <button
                type="button"
                onClick={() => {
                  toggleCategory(cat.id)
                  onCategoryClick?.(cat.id)
                }}
                className={cn(
                  "group flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                  parentActive
                    ? "bg-buyer-muted/80 text-orange-950 dark:bg-buyer-muted dark:text-buyer-light"
                    : "text-zinc-900 hover:bg-muted/80 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-lg">{cat.icon}</span>
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
                      onClick={() => onCategoryClick?.(cat.id, sub.id)}
                      className={cn(
                        "flex w-full items-center justify-between border-l-2 py-2 pl-11 pr-4 text-left text-sm transition",
                        subActive
                          ? "border-buyer bg-buyer-muted/70 font-medium text-orange-950 dark:border-buyer dark:bg-buyer-muted dark:text-buyer-light"
                          : "border-transparent text-zinc-600 hover:border-brand/30 hover:bg-brand-muted/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      )}
                    >
                      <span className="min-w-0 truncate">{sub.name}</span>
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
