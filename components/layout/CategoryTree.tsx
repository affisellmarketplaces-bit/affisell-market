"use client"

import { useCallback, useState } from "react"
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import { FastLink } from "@/components/navigation/fast-link"
import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { cn } from "@/lib/utils"

type Subcategory = {
  id: string
  name: string
  slug: string
  count: number
}

type CategoryNode = {
  id: string
  name: string
  icon: string
  slug: string
  count: number
  subcategories: Subcategory[]
}

type CategoriesPayload = {
  categories?: CategoryNode[]
  catalogTotal?: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CategoriesPayload>)

type Props = {
  onNavigate?: () => void
  className?: string
}

/**
 * Expandable L1 → L2 category tree for the mobile hamburger drawer.
 * L2 navigates to SEO browse paths; “all aisles” opens home catalog.
 */
export function CategoryTree({ onNavigate, className }: Props) {
  const t = useTranslations("marketplace.mobileHub")
  const { data, isLoading, error } = useSWR<CategoriesPayload>("/api/categories", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = data?.categories ?? []

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)} aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-xl bg-zinc-800/60"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    )
  }

  if (error || categories.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-zinc-500">{t("categoriesEmpty")}</p>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      <ul className="space-y-0.5" role="list">
        {categories.map((cat) => {
          const open = expandedId === cat.id
          const hasKids = cat.subcategories.length > 0
          return (
            <li key={cat.id}>
              <div
                className={cn(
                  "flex items-center gap-1 rounded-xl border border-transparent transition",
                  open && "border-white/10 bg-white/[0.04]"
                )}
              >
                <button
                  type="button"
                  onClick={() => (hasKids ? toggle(cat.id) : undefined)}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left",
                    !hasKids && "cursor-default"
                  )}
                  aria-expanded={hasKids ? open : undefined}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-300",
                      open && "bg-violet-500/20 text-violet-200"
                    )}
                    aria-hidden
                  >
                    {hasKids ? (
                      open ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )
                    ) : (
                      <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="xs" />
                    )}
                  </span>
                  {hasKids ? (
                    <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="xs" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                    {cat.name}
                  </span>
                  {cat.count > 0 ? (
                    <span className="shrink-0 tabular-nums text-[10px] font-medium text-zinc-500">
                      {cat.count}
                    </span>
                  ) : null}
                </button>
                <FastLink
                  href={categoryBrowsePath(cat.slug)}
                  onClick={onNavigate}
                  className="mr-1.5 shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300/90 hover:bg-violet-500/15 hover:text-violet-100"
                  aria-label={t("browseCategory", { name: cat.name })}
                >
                  →
                </FastLink>
              </div>

              {open && hasKids ? (
                <ul className="mb-1 ml-4 space-y-0.5 border-l border-white/10 pl-3 pt-0.5" role="list">
                  {cat.subcategories.map((sub) => (
                    <li key={sub.id}>
                      <FastLink
                        href={
                          sub.slug
                            ? categoryBrowsePath(sub.slug)
                            : marketplaceCatalogHref("/", {
                                category: cat.id,
                                subcategory: sub.id,
                              })
                        }
                        onClick={onNavigate}
                        className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                      >
                        <span className="truncate">{sub.name}</span>
                        {sub.count > 0 ? (
                          <span className="shrink-0 tabular-nums text-[10px] text-zinc-500">
                            {sub.count}
                          </span>
                        ) : null}
                      </FastLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      <FastLink
        href={marketplaceCatalogHref("/")}
        onClick={onNavigate}
        className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 text-sm font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-500/20"
      >
        <LayoutGrid className="size-4 shrink-0" aria-hidden />
        {t("seeAllAisles")}
      </FastLink>
    </div>
  )
}
