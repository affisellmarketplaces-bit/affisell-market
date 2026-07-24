"use client"

import { useCallback, useState, type ReactNode } from "react"
import Link from "next/link"
import { Filter, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { MarketplaceShipsToChip } from "@/components/marketplace/marketplace-ships-to-chip"
import { MobileSheetBodySkeleton } from "@/components/marketplace/mobile-sheet-body-skeleton"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useDeferredMount } from "@/hooks/use-deferred-mount"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { MARKETPLACE_OFFER_FACET_KEY } from "@/lib/marketplace-discovery-facets-shared"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { cn } from "@/lib/utils"

type Cat = { id: string; name: string; icon: string; slug: string; count: number }

type Props = {
  catalogBasePath: string
  activeCategoryId: string | null
  catalogTotal?: number
  categories: Cat[]
  newCount?: number
  filtersPanel: ReactNode
  className?: string
}

function FiltersSheet({
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
  const bodyReady = useDeferredMount(open)

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
            className="affisell-inp-tap flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label={t("close")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[calc(min(88dvh,720px)-3.5rem)] overflow-y-auto overscroll-y-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {bodyReady ? children : <MobileSheetBodySkeleton />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Mobile-only sticky filter strip — merges departments + Pan-EU + condition + filters
 * into one ~44px row (AUDIT_MOBILE surgical fix).
 */
export function StickyFilterBarPro({
  catalogBasePath,
  activeCategoryId,
  catalogTotal,
  categories,
  newCount,
  filtersPanel,
  className,
}: Props) {
  const tHub = useTranslations("marketplace.mobileHub")
  const tDept = useTranslations("marketplace.departmentRail")
  const [filtersOpen, setFiltersOpen] = useState(false)

  const openFilters = useCallback(() => {
    buyerHaptic("tap")
    setFiltersOpen(true)
  }, [])

  const topCats = categories.filter((c) => c.count > 0).slice(0, 4)

  return (
    <>
      {/* Fixed 44px slot — sticky paints inside, height never shifts (CLS). */}
      <div className={cn("mb-2 h-11 md:hidden", className)}>
        <div
          className="sticky z-30 -mx-3 h-11 border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/90"
          style={{ top: "var(--affisell-site-header-offset-sticky, 3.5rem)" }}
        >
          <div className="flex h-11 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex h-7 shrink-0 items-center rounded-full bg-zinc-900 px-3 text-[10px] font-bold tracking-tight text-white">
              Pan-EU · 33
            </div>

            <Link
              href={catalogFilterHref(catalogBasePath)}
              scroll={false}
              className={cn(
                "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums",
                !activeCategoryId
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              )}
            >
              {tDept("allCatalog")}
              {typeof catalogTotal === "number" ? (
                <span className="ml-1 opacity-80">({catalogTotal})</span>
              ) : null}
            </Link>

            {topCats.map((c) => {
              const on = activeCategoryId === c.id
              return (
                <Link
                  key={c.id}
                  href={categoryBrowsePath(c.slug)}
                  scroll={false}
                  className={cn(
                    "inline-flex h-7 w-[7.5rem] shrink-0 items-center justify-center gap-1 truncate rounded-full px-2 text-[11px] font-semibold",
                    on
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                  )}
                >
                  <CategoryGlyph name={c.name} slug={c.slug} icon={c.icon} size="xs" />
                  <span className="truncate">
                    {c.name}
                    {c.count > 0 ? <span className="opacity-70">({c.count})</span> : null}
                  </span>
                </Link>
              )
            })}

            <Link
              href={catalogFilterHref(catalogBasePath, `${MARKETPLACE_OFFER_FACET_KEY}=new`)}
              scroll={false}
              className="inline-flex h-7 shrink-0 items-center rounded-full bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800"
            >
              New
              {typeof newCount === "number" ? (
                <span className="ml-1 opacity-80">({newCount})</span>
              ) : null}
            </Link>

            <MarketplaceShipsToChip
              basePath={catalogBasePath}
              className="h-7 shrink-0 px-2.5 py-0 text-[10px]"
            />

            <button
              type="button"
              onClick={openFilters}
              className="affisell-inp-tap inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white"
              aria-label={tHub("filters")}
            >
              <Filter className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={tHub("filters")}
      >
        {filtersPanel}
      </FiltersSheet>
    </>
  )
}
