"use client"

import { ChevronRight, LayoutGrid } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import {
  PREMIUM_MARKETPLACE_HOME,
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

export function CategorySidebar({
  categories,
  catalogTotal,
  activeCategoryId,
  catalogBasePath = "/",
  className,
}: Props) {
  const allActive = !activeCategoryId

  return (
    <aside
      className={cn("hidden w-[320px] shrink-0 overflow-hidden rounded-2xl shadow-lg lg:block", className)}
      style={{ background: PREMIUM_MARKETPLACE_HOME.sidebarBg }}
      aria-label="Categories"
    >
      <div className="px-4 py-3" style={{ background: PREMIUM_MARKETPLACE_HOME.sidebarHeader }}>
        <p className="text-sm font-bold uppercase tracking-wide text-white">Categories</p>
        <p className="text-xs" style={{ color: PREMIUM_MARKETPLACE_HOME.sidebarHeaderSub }}>
          Full Google tree — expand any branch
        </p>
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        <FastLink
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className={cn(
            "flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition",
            allActive ? "text-violet-900" : "text-violet-100 hover:bg-white/5"
          )}
          style={allActive ? { backgroundColor: PREMIUM_MARKETPLACE_HOME.sidebarActive } : undefined}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-violet-600 text-white">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate">All Catalog</span>
          <span className="tabular-nums text-xs opacity-80">{catalogTotal}</span>
          <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
        </FastLink>

        {categories.map((cat) => {
          const active = activeCategoryId === cat.id
          return (
            <FastLink
              key={cat.id}
              href={categoryRailHref(catalogBasePath, cat)}
              scroll={false}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition",
                active ? "text-violet-900" : "text-violet-100 hover:bg-white/5"
              )}
              style={active ? { backgroundColor: PREMIUM_MARKETPLACE_HOME.sidebarActive } : undefined}
            >
              <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="sm" inSheet />
              <span className="min-w-0 flex-1 truncate">{cat.name}</span>
              {cat.count > 0 ? (
                <span className="tabular-nums text-xs opacity-80">{cat.count}</span>
              ) : null}
              <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
            </FastLink>
          )
        })}
      </nav>
    </aside>
  )
}
