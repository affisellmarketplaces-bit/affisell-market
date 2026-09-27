"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronRight, LayoutGrid, Menu, Tag } from "lucide-react"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import { FastLink } from "@/components/navigation/fast-link"
import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { cn } from "@/lib/utils"

type Subcategory = { id: string; name: string; slug: string; count: number }
type CategoryNode = {
  id: string
  name: string
  icon: string
  slug: string
  count: number
  subcategories: Subcategory[]
}
type CategoriesPayload = { categories?: CategoryNode[] }
type BrandsPayload = { brands?: Array<{ value: string; count: number }> }

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json())

/** A category is flagged "popular" once real listed inventory clears this bar — never a fabricated badge. */
const POPULAR_COUNT_THRESHOLD = 50
/** Delay before closing on mouse-leave — long enough to cross the gap to the flyout panel without flicker. */
const CLOSE_DELAY_MS = 180

type MenuPosition = { top: number; left: number }

export function PublicCategoriesMegaMenu() {
  const t = useTranslations("PublicNav")
  const tm = useTranslations("PublicNav.megaMenu")
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const { data, isLoading } = useSWR<CategoriesPayload>("/api/categories", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const categories = useMemo(() => data?.categories ?? [], [data])

  useEffect(() => {
    if (!open || activeId || categories.length === 0) return
    setActiveId(categories[0]!.id)
  }, [open, activeId, categories])

  const active = categories.find((c) => c.id === activeId) ?? null

  const { data: brandsData, isLoading: brandsLoading } = useSWR<BrandsPayload>(
    active ? `/api/categories/${active.id}/brands` : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  )
  const brands = brandsData?.brands ?? []

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [cancelClose])

  useEffect(() => cancelClose, [cancelClose])

  /**
   * Body carries `overflow-x: clip` site-wide (prevents mobile horizontal scroll), which per the CSS
   * spec forces the y-axis to clip too — any plain `position: absolute` dropdown nested in the sticky
   * header gets silently cut off. Same fix already used by LanguageSwitcher: portal to `document.body`
   * with `position: fixed` and a JS-computed position, escaping the clipped ancestor entirely.
   */
  const updateMenuPosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 8, left: r.left })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!(e.target instanceof Node)) return
      if (rootRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  const brandHref = (categoryId: string, brand: string) =>
    marketplaceCatalogHref("/", new URLSearchParams({ category: categoryId, brand }))

  const panel =
    mounted && open && menuPos
      ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[250] flex w-[42rem] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-violet-950/10 dark:border-zinc-800 dark:bg-zinc-950"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="flex min-h-0 flex-1">
              <div className="w-[15rem] shrink-0 border-r border-zinc-100 bg-zinc-50/70 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                {isLoading ? (
                  <div className="space-y-1.5 px-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
                    ))}
                  </div>
                ) : (
                  <ul role="none">
                    {categories.map((cat) => (
                      <li key={cat.id} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onMouseEnter={() => setActiveId(cat.id)}
                          onFocus={() => setActiveId(cat.id)}
                          className={cn(
                            "flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition",
                            cat.id === activeId
                              ? "bg-white text-violet-800 shadow-sm dark:bg-zinc-950 dark:text-violet-200"
                              : "text-zinc-700 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-zinc-950/50"
                          )}
                        >
                          <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="xs" tone="bare" />
                          <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                          {cat.count >= POPULAR_COUNT_THRESHOLD ? (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              {tm("popular")}
                            </span>
                          ) : null}
                          <ChevronRight className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="min-w-0 flex-1 p-4">
                {active ? (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{active.name}</h3>
                      <FastLink
                        href={marketplaceCatalogHref("/", { category: active.id })}
                        onClick={() => setOpen(false)}
                        className="shrink-0 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                      >
                        {tm("seeAllIn", { name: active.name })}
                      </FastLink>
                    </div>

                    {active.subcategories.length > 0 ? (
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5" role="none">
                        {active.subcategories.slice(0, 10).map((sub) => (
                          <li key={sub.id} role="none">
                            <FastLink
                              href={marketplaceCatalogHref("/", { category: sub.id })}
                              onClick={() => setOpen(false)}
                              className="flex min-h-8 items-center justify-between gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                            >
                              <span className="min-w-0 truncate">{sub.name}</span>
                              {sub.count > 0 ? (
                                <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">{sub.count}</span>
                              ) : null}
                            </FastLink>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <Tag className="size-3" aria-hidden />
                        {tm("brandsTitle")}
                      </p>
                      {brandsLoading ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
                          ))}
                        </div>
                      ) : brands.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {brands.map((b) => (
                            <FastLink
                              key={b.value}
                              href={brandHref(active.id, b.value)}
                              onClick={() => setOpen(false)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-violet-500/50"
                            >
                              {b.value}
                              <span className="tabular-nums text-zinc-400">{b.count}</span>
                            </FastLink>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">{tm("noBrands")}</p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <FastLink
              href={marketplaceCatalogHref("/")}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center gap-2 border-t border-zinc-100 bg-zinc-50/70 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-violet-300 dark:hover:bg-violet-950/30"
            >
              <LayoutGrid className="size-4" aria-hidden />
              {tm("seeAllAisles")}
            </FastLink>
          </div>,
          document.body
        )
      : null

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        className="mr-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-violet-500/50"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Menu className="size-4" aria-hidden />
        {t("categoriesEntry")}
      </button>

      {panel}
    </div>
  )
}
