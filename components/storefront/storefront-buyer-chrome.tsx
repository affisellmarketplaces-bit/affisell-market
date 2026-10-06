"use client"

import { X } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { StorefrontBuyerHeader } from "@/components/storefront/storefront-buyer-header"
import { StorefrontCategoryDrawerNav } from "@/components/storefront/storefront-category-drawer-nav"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { useHeaderMode, useMotionAllowed } from "@/hooks/use-header-mode"
import { visibleHeaderMode } from "@/lib/storefront/header-mode"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

// Downloaded the first time someone opens the search — never part of the initial page weight.
const StorefrontSearchPalette = dynamic(
  () => import("@/components/storefront/storefront-search-palette").then((m) => m.StorefrontSearchPalette),
  { ssr: false }
)

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  trustRailText?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  categories?: StorefrontCategoryGroup[]
  /** Fetch drawer categories on first open when `categories` is empty. */
  categoriesSlug?: string
  totalProducts?: number
  shopHomePath?: string
  trust?: StorefrontTrustSnapshot | null
  isCustomDomain?: boolean
  /**
   * Smart header: fixed to the top, away while reading down, back as a compact bar on the way up. Live storefront only —
   * the Brand Studio preview scrolls inside the editor and keeps the plain header.
   */
  smartHeader?: boolean
}

const EMPTY_CATEGORIES: StorefrontCategoryGroup[] = []

export function StorefrontBuyerChrome({
  storeName,
  logoUrl,
  accent = "#7c3aed",
  primary = "#18181b",
  trustRailText,
  nameBadge = "parallelogram",
  headerBrandAlign = "left",
  categories,
  categoriesSlug,
  totalProducts = 0,
  shopHomePath = "/",
  trust = null,
  isCustomDomain = false,
  smartHeader = false,
}: Props) {
  const serverCategories = categories ?? EMPTY_CATEGORIES
  const t = useTranslations("storefront.buyerChrome")
  const cartCount = useBuyerCartCount()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Search needs the store slug (live storefront); the Brand Studio preview has none and shows no search.
  const searchEnabled = Boolean(categoriesSlug)
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // ---- smart header ---------------------------------------------------------------------------------------------
  // `position: sticky` cannot work here: the header's container is only as tall as the header, and on phones html/body
  // are `overflow-x: hidden`, which makes body a scroll container that never scrolls. So the header is `fixed` and an
  // in-flow spacer of the same height keeps the page layout exactly where it was.
  const motionAllowed = useMotionAllowed()
  const wantsSmartHeader = smartHeader && motionAllowed
  const headerRef = useRef<HTMLDivElement>(null)
  const [spacerHeight, setSpacerHeight] = useState<number | null>(null)
  const [focusWithin, setFocusWithin] = useState(false)

  // Measured BEFORE paint and switched to fixed in the same commit: no frame where the page jumps up under the header.
  useLayoutEffect(() => {
    if (!wantsSmartHeader) {
      setSpacerHeight(null)
      return
    }
    const el = headerRef.current
    if (el) setSpacerHeight(Math.ceil(el.getBoundingClientRect().height))
  }, [wantsSmartHeader])

  const smartActive = wantsSmartHeader && spacerHeight !== null
  const scrollMode = useHeaderMode(smartActive)
  const headerMode = visibleHeaderMode(scrollMode, drawerOpen || focusWithin)

  // The spacer always matches the COMPLETE header (fonts loading, trust rail wrapping on resize): read only while complete.
  const headerModeRef = useRef(headerMode)
  useEffect(() => {
    headerModeRef.current = headerMode
  }, [headerMode])
  useEffect(() => {
    const el = headerRef.current
    if (!smartActive || !el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (headerModeRef.current !== "full") return
      const h = Math.ceil(el.getBoundingClientRect().height)
      setSpacerHeight((current) => (current !== null && Math.abs(current - h) > 1 ? h : current))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [smartActive])
  const [lazyCategories, setLazyCategories] = useState<StorefrontCategoryGroup[] | null>(null)
  const [lazyTotalProducts, setLazyTotalProducts] = useState(0)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const categoriesFetchedRef = useRef(false)

  const drawerCategories =
    serverCategories.length > 0 ? serverCategories : (lazyCategories ?? EMPTY_CATEGORIES)
  const drawerTotalProducts =
    serverCategories.length > 0 ? totalProducts : lazyTotalProducts

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // "/" or Ctrl/⌘+K opens the search from anywhere on the page (never while typing in a field).
  useEffect(() => {
    if (!searchEnabled) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey
      const palette = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if ((slash && !typing) || palette) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [searchEnabled])

  useEffect(() => {
    categoriesFetchedRef.current = false
    setLazyCategories(null)
    setLazyTotalProducts(0)
  }, [categoriesSlug])

  useEffect(() => {
    if (
      !drawerOpen ||
      serverCategories.length > 0 ||
      !categoriesSlug ||
      categoriesFetchedRef.current
    ) {
      return
    }
    const ac = new AbortController()
    setCategoriesLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/shops/${encodeURIComponent(categoriesSlug)}/categories`, {
          signal: ac.signal,
          cache: "force-cache",
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          groups?: StorefrontCategoryGroup[]
          totalProducts?: number
        }
        if (Array.isArray(data.groups) && data.groups.length > 0) {
          categoriesFetchedRef.current = true
          setLazyCategories(data.groups)
          setLazyTotalProducts(Math.max(0, Math.round(Number(data.totalProducts) || 0)))
        }
      } catch {
        /* abort / offline */
      } finally {
        if (!ac.signal.aborted) setCategoriesLoading(false)
      }
    })()
    return () => ac.abort()
  }, [categoriesSlug, drawerOpen, serverCategories.length])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [closeDrawer, drawerOpen])

  return (
    <>
      <div style={smartActive ? { height: spacerHeight ?? undefined } : undefined}>
        <div
          ref={headerRef}
          data-header-state={smartActive ? headerMode : undefined}
          className={cn(
            smartActive
              ? "fixed inset-x-0 top-0 z-[120] transition-[transform,box-shadow] duration-300 ease-out will-change-transform"
              : "sticky top-0 z-[120]",
            smartActive && headerMode === "hidden" && "-translate-y-full",
            // The floating bar casts a shadow; a hidden header must not leak one into the top of the viewport.
            smartActive && headerMode === "bar" && "shadow-[0_12px_32px_-14px_rgba(0,0,0,0.5)]"
          )}
          // A header in use is never hidden: keyboard focus anywhere inside keeps it on screen.
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
          }}
        >
        <StorefrontBuyerHeader
          storeName={storeName}
          logoUrl={logoUrl}
          accent={accent}
          primary={primary}
          trustRailText={trustRailText}
          nameBadge={nameBadge}
          headerBrandAlign={headerBrandAlign}
          cartCount={cartCount}
          menuLabel={t("openCategories")}
          cartLabel={t("cart")}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenSearch={searchEnabled ? () => setSearchOpen(true) : undefined}
          searchLabel={t("search")}
          menuExpanded={drawerOpen}
          menuControlsId="storefront-category-drawer"
          trust={trust}
          isCustomDomain={isCustomDomain}
          shopHomePath={shopHomePath}
        />
        </div>
      </div>

      {searchOpen && categoriesSlug ? (
        <StorefrontSearchPalette slug={categoriesSlug} accent={accent} onClose={closeSearch} />
      ) : null}

      {drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[130] bg-zinc-950/45 backdrop-blur-[2px]"
          aria-label={t("closeCategories")}
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        id="storefront-category-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-[140] flex w-[min(100vw-3rem,22rem)] flex-col border-r border-zinc-200/80 bg-gradient-to-b from-white via-violet-50/30 to-zinc-50 shadow-2xl transition-transform duration-300 dark:border-zinc-800 dark:from-zinc-950 dark:via-violet-950/20 dark:to-zinc-950",
          drawerOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, white), transparent)` }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{t("drawerEyebrow")}</p>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{storeName}</p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={t("closeCategories")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <Suspense
          fallback={
            <div className="flex-1 animate-pulse p-3">
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/80 dark:bg-zinc-800" />
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/80" />
              <div className="h-10 rounded-xl bg-zinc-200/40 dark:bg-zinc-800/60" />
            </div>
          }
        >
          {categoriesLoading && drawerCategories.length === 0 ? (
            <div className="flex-1 animate-pulse p-3" aria-busy="true">
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/80 dark:bg-zinc-800" />
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/80" />
              <div className="h-10 rounded-xl bg-zinc-200/40 dark:bg-zinc-800/60" />
            </div>
          ) : (
            <StorefrontCategoryDrawerNav
              categories={drawerCategories}
              totalProducts={drawerTotalProducts}
              shopHomePath={shopHomePath}
              onPickCategory={closeDrawer}
            />
          )}
        </Suspense>
      </aside>
    </>
  )
}
