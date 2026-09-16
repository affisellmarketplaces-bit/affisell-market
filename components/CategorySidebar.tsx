"use client"

import { useState } from "react"
import { LayoutGrid, X } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import type { PremiumCategoryItem } from "@/lib/marketplace-premium-home-shared"
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
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Layout footprint: 48px hamburger only — drawer is fixed overlay. */}
      <div className={cn("hidden w-14 shrink-0 justify-center pt-2 lg:flex", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-12 flex-col items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#16113A] shadow-xl transition-all hover:scale-105"
          title="Open categories"
          aria-label="Open categories"
          aria-expanded={open}
        >
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[999] hidden lg:block">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <aside
            className="absolute bottom-4 left-4 top-4 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14102E] shadow-2xl animate-in slide-in-from-left-4 duration-300"
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-4">
              <div>
                <p className="text-sm font-black tracking-[0.2em] text-white">CATEGORIES</p>
                <p className="text-xs text-white/70">{catalogTotal} products</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-full bg-white text-[#16113A]"
                aria-label="Close categories"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <FastLink
                href={catalogFilterHref(catalogBasePath)}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold",
                  !activeCategoryId
                    ? "bg-white text-[#16113A]"
                    : "text-white/80 hover:bg-white/10"
                )}
              >
                <LayoutGrid className="size-4" /> All Catalog ({catalogTotal})
              </FastLink>
              <div className="my-2 h-px bg-white/10" />
              {categories.map((cat) => (
                <FastLink
                  key={cat.id}
                  href={categoryRailHref(catalogBasePath, cat)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="sm" inSheet />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className="text-xs opacity-40">{cat.count}</span>
                </FastLink>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}
