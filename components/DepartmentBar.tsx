"use client"

import { LayoutGrid } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
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
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
            >
              Departments
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] normal-case tracking-normal"
                style={{ backgroundColor: "#F3E8FF", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
              >
                {categories.length}
              </span>
            </p>
            <p className="text-xs leading-snug" style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsHint }}>
              Department-store navigation — each department opens its aisles in the left column.
            </p>
          </div>
        </div>
      </div>

      <ScrollFadeRow ariaLabel="Departments">
        <FastLink
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white transition",
            allActive ? "shadow-md" : "opacity-90 hover:opacity-100"
          )}
          style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive }}
        >
          All Catalog
          <span className="opacity-90">({catalogTotal})</span>
        </FastLink>

        {categories.map((cat) => {
          const style = resolveDepartmentPillStyle(cat.name)
          const active = activeCategoryId === cat.id
          return (
            <FastLink
              key={cat.id}
              href={categoryRailHref(catalogBasePath, cat)}
              scroll={false}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition",
                active && "ring-2 ring-violet-400 ring-offset-1"
              )}
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="md" />
              {cat.name}
              {cat.count > 0 ? <span className="opacity-75">({cat.count})</span> : null}
            </FastLink>
          )
        })}
      </ScrollFadeRow>
    </section>
  )
}
