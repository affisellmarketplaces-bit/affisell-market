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

export function CategorySidebar({ categories, catalogTotal, activeCategoryId, catalogBasePath = "/", className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* SEUL ELEMENT DANS LE LAYOUT : un bouton 3 tirets de 48px - ne casse rien */}
      <div className={cn("hidden lg:flex w- shrink-0 justify-center pt-2", className)}>
        <button
          onClick={() => setOpen(true)}
          className="size-12 rounded-full bg-[#16113A] border border-white/10 shadow-xl flex flex-col items-center justify-center gap- hover:scale-105 transition-all"
          title="Ouvrir categories"
        >
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
          <span style={{ width: 20, height: 2.5, background: "white", borderRadius: 99 }} />
        </button>
      </div>

      {/* DRAWER EN OVERLAY FIXE - HORS LAYOUT, DONC NE CASSE PAS LE HERO */}
      {open && (
        <div className="fixed inset-0 z-[999] hidden lg:block">
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute left-4 top-4 bottom-4 w- rounded- bg-[#14102E] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-violet-600 to-cyan-500">
              <div>
                <p className="text- font-black tracking-[0.2em] text-white">CATEGORIES</p>
                <p className="text- text-white/70">{catalogTotal} produits</p>
              </div>
              <button onClick={() => setOpen(false)} className="size-9 rounded-full bg-white text-[#16113A] flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              <FastLink href={catalogFilterHref(catalogBasePath)} onClick={() => setOpen(false)} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text- font-bold",!activeCategoryId? "bg-white text-[#16113A]" : "text-white/80 hover:bg-white/10")}>
                <LayoutGrid className="size-4" /> All Catalog ({catalogTotal})
              </FastLink>
              <div className="h-px bg-white/10 my-2" />
              {categories.map((cat) => (
                <FastLink key={cat.id} href={categoryRailHref(catalogBasePath, cat)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text- text-white/70 hover:bg-white/10 hover:text-white">
                  <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="sm" inSheet />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className="text- opacity-40">{cat.count}</span>
                </FastLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}