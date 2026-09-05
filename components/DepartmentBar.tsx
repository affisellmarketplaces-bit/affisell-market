"use client"

import { LayoutGrid, Zap } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import {
  PREMIUM_MARKETPLACE_HOME,
  resolveDepartmentPillStyle,
  type PremiumCategoryItem,
} from "@/lib/marketplace-premium-home-shared"
import { cn } from "@/lib/utils"

type Props = {
  categories: PremiumCategoryItem[]
  catalogTotal: number
  activeCategoryId: string | null
  catalogBasePath?: string
  className?: string
}

export function DepartmentBar({
  categories,
  catalogTotal,
  activeCategoryId,
  catalogBasePath = "/",
  className,
}: Props) {
  const allActive = !activeCategoryId

  return (
    <section
      className={cn("rounded-2xl bg-white p-3 shadow-md shadow-indigo-950/10", className)}
      aria-label="Departments"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#F3E8FF", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
          >
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
            >
              Departments
            </p>
            <p className="text-xs leading-snug" style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsHint }}>
              Department-store navigation — each department opens its aisles in the left column.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 items-center gap-1">
          <FastLink
            href={catalogFilterHref(catalogBasePath)}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition",
              allActive ? "shadow-md" : "opacity-90 hover:opacity-100"
            )}
            style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive }}
          >
            All Catalog
            <span className="opacity-90">({catalogTotal})</span>
          </FastLink>
          <FastLink
            href={discoverSwipeHref()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition hover:scale-105"
            style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive }}
            aria-label="Swipe catalog"
          >
            <Zap className="size-3.5" aria-hidden />
          </FastLink>
        </div>

        {categories.map((cat) => {
          const style = resolveDepartmentPillStyle(cat.name)
          const active = activeCategoryId === cat.id
          return (
            <div key={cat.id} className="flex shrink-0 items-center gap-1">
              <FastLink
                href={categoryRailHref(catalogBasePath, cat)}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition",
                  active && "ring-2 ring-violet-400 ring-offset-1"
                )}
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="xs" />
                <span className="max-w-[9rem] truncate">
                  {cat.name}
                  {cat.count > 0 ? <span className="ml-1 opacity-75">({cat.count})</span> : null}
                </span>
              </FastLink>
              <FastLink
                href={discoverSwipeHref({ category: cat.id })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105"
                style={{ backgroundColor: "#EDE9FE", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
                aria-label={`Swipe ${cat.name}`}
              >
                <Zap className="size-3.5" aria-hidden />
              </FastLink>
            </div>
          )
        })}
      </div>
    </section>
  )
}
