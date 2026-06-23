"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { Sparkles, Zap } from "lucide-react"

import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import { catalogFilterHref, catalogFilterHrefFromParams } from "@/lib/marketplace-catalog-nav.client"
import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { InfiniteMarquee } from "@/components/ui/infinite-marquee"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Cat = { id: string; name: string; icon: string; slug: string; order: number; count: number }

function DepartmentRailItems({
  data,
  activeCategoryId,
  activeSubcategoryId,
  catalogBasePath,
  t,
}: {
  data: { categories: Cat[]; catalogTotal?: number }
  activeCategoryId: string | null
  activeSubcategoryId: string | null
  catalogBasePath: string
  t: ReturnType<typeof useTranslations<"marketplace.departmentRail">>
}) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-xs font-semibold transition",
            !activeCategoryId && !activeSubcategoryId
              ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/25"
              : "border-zinc-200/80 bg-white/90 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
          )}
        >
          {t("allCatalog")}
          {typeof data.catalogTotal === "number" ? (
            <span className="ml-1 opacity-80">({data.catalogTotal})</span>
          ) : null}
        </Link>
        <Link
          href={discoverSwipeHref()}
          title={t("swipeAll")}
          className={cn(
            affisellBrand.epoxyCta,
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white transition hover:scale-105 active:scale-95"
          )}
          aria-label={t("swipeAll")}
        >
          <Zap className="size-3.5" aria-hidden />
        </Link>
      </div>
      {data.categories.map((c) => {
        const on = activeCategoryId === c.id && !activeSubcategoryId
        return (
          <div key={c.id} className="flex shrink-0 items-center gap-1">
            <Link
              href={catalogFilterHrefFromParams(
                catalogBasePath,
                new URLSearchParams({ category: c.id })
              )}
              scroll={false}
              className={cn(
                affisellBrand.quickLink,
                "affisell-quick-link--buyer inline-flex min-h-11 shrink-0 items-center !rounded-full !py-2 text-xs",
                on ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-violet-50 dark:ring-offset-zinc-950" : ""
              )}
            >
              <CategoryGlyph name={c.name} slug={c.slug} icon={c.icon} size="xs" />
              <span className="max-w-[10rem] truncate">
                {c.name}
                {c.count > 0 ? <span className="ml-1 opacity-70">({c.count})</span> : null}
              </span>
            </Link>
            <Link
              href={discoverSwipeHref({ category: c.id })}
              title={t("swipeCategory", { name: c.name })}
              className={cn(
                affisellBrand.epoxyCta,
                "flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-600/95 text-white transition hover:scale-105 active:scale-95"
              )}
              aria-label={t("swipeCategory", { name: c.name })}
            >
              <Zap className="size-3.5" aria-hidden />
            </Link>
          </div>
        )
      })}
    </>
  )
}

export function MarketplaceDepartmentRail({
  activeCategoryId,
  activeSubcategoryId,
  catalogBasePath = PUBLIC_MARKETPLACE_BROWSE_PATH,
  categoriesPayload,
}: {
  activeCategoryId: string | null
  activeSubcategoryId: string | null
  catalogBasePath?: string
  categoriesPayload?: { categories: Cat[]; catalogTotal?: number }
}) {
  const t = useTranslations("marketplace.departmentRail")
  const { data: swrData, isLoading } = useSWR<{ categories: Cat[]; catalogTotal?: number }>(
    categoriesPayload ? null : "/api/categories",
    fetcher,
    {
      fallbackData: categoriesPayload,
      refreshInterval: 300_000,
      revalidateOnMount: !categoriesPayload,
    }
  )

  const data = categoriesPayload ?? swrData

  if ((!categoriesPayload && isLoading) || !data?.categories?.length) return null

  const itemsProps = {
    data,
    activeCategoryId,
    activeSubcategoryId,
    catalogBasePath,
    t,
  }

  return (
    <section
      className={cn(
        affisellBrand.epoxySurfaceLight,
        "affisell-department-marquee mt-3 overflow-hidden rounded-2xl p-3 sm:mt-6 sm:p-4"
      )}
      aria-label={t("ariaLabel")}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm shadow-violet-600/30">
          <Sparkles className="size-3" aria-hidden />
          {t("badge")}
        </span>
        <p className="hidden text-xs font-medium text-violet-950/80 sm:block dark:text-violet-100/85">
          {t("hint")}
        </p>
        <p className="ml-auto hidden text-[10px] font-medium uppercase tracking-wider text-violet-600/70 lg:block dark:text-violet-300/70">
          {t("marqueeHint")}
        </p>
      </div>
      <InfiniteMarquee className="affisell-department-marquee__track -mx-1 px-1">
        <DepartmentRailItems {...itemsProps} />
      </InfiniteMarquee>
    </section>
  )
}
