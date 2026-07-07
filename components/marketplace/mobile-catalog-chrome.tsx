"use client"

import { useState, type ReactNode } from "react"
import { Filter, LayoutGrid, Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { openMobileBuyerHub } from "@/lib/buyer-hub-events"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  productCount: number
  loading: boolean
  hasFilters: boolean
  activeFilterLabel: string
  onClearFilters: () => void
  categoriesPanel: (close: () => void) => ReactNode
  filtersPanel: ReactNode
}

function MobileSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  const t = useTranslations("marketplace.mobileHub")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(88dvh,720px)] rounded-t-3xl border-white/10 bg-zinc-950 p-0 text-zinc-100"
      >
        <h2 className="sr-only">{title}</h2>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label={t("close")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[calc(min(88dvh,720px)-3.5rem)] overflow-y-auto overscroll-contain px-3 py-3">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Sticky mobile toolbar — menu, categories & filters in bottom sheets. */
export function MobileCatalogChrome({
  productCount,
  loading,
  hasFilters,
  activeFilterLabel,
  onClearFilters,
  categoriesPanel,
  filtersPanel,
}: Props) {
  const t = useTranslations("marketplace.mobileHub")
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleClearFilters = () => {
    setCategoriesOpen(false)
    setFiltersOpen(false)
    onClearFilters()
  }
  const summaryLabel = loading ? t("loading") : t("listingShort", { count: productCount })

  return (
    <>
      <div className="sticky top-[calc(2.85rem+env(safe-area-inset-top,0px))] z-30 -mx-3 mb-2 border-b border-white/10 bg-zinc-950/82 px-3 py-1.5 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/70 md:hidden dark:bg-zinc-950/88">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openMobileBuyerHub}
            className="h-10 min-h-10 shrink-0 gap-1.5 border-white/15 bg-white/5 px-2.5 text-xs text-zinc-100"
            aria-label={t("menu")}
          >
            <Menu className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCategoriesOpen(true)}
            className="h-10 min-h-10 flex-1 gap-1.5 border-violet-500/30 bg-violet-500/10 px-2.5 text-xs text-violet-100"
          >
            <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
            {t("categories")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(true)}
            className="h-10 min-h-10 flex-1 gap-1.5 border-white/15 bg-white/5 px-2.5 text-xs text-zinc-100"
          >
            <Filter className="size-3.5 shrink-0" aria-hidden />
            {t("filters")}
          </Button>
        </div>
        <div className="mt-1.5 flex min-h-8 items-center justify-between gap-2 text-[11px] text-zinc-400">
          <span className="truncate font-medium text-zinc-200">{summaryLabel}</span>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className={cn(
                "inline-flex max-w-[60%] min-h-8 items-center gap-1 truncate rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-100"
              )}
            >
              <span className="truncate">{activeFilterLabel}</span>
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ) : <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{t("filters")}</span>}
        </div>
      </div>

      <MobileSheet open={categoriesOpen} onOpenChange={setCategoriesOpen} title={t("categoriesTitle")}>
        {categoriesPanel(() => setCategoriesOpen(false))}
      </MobileSheet>

      <MobileSheet open={filtersOpen} onOpenChange={setFiltersOpen} title={t("filtersTitle")}>
        <div className="pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">{filtersPanel}</div>
      </MobileSheet>
    </>
  )
}
