"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { StorefrontBuyerHeader } from "@/components/storefront/storefront-buyer-header"
import { StorefrontCategoryDrawerNav } from "@/components/storefront/storefront-category-drawer-nav"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  categories?: StorefrontCategoryGroup[]
  /** Fetch drawer categories on first open when `categories` is empty. */
  categoriesSlug?: string
  totalProducts?: number
  shopHomePath?: string
  trust?: StorefrontTrustSnapshot | null
  isCustomDomain?: boolean
}

const EMPTY_CATEGORIES: StorefrontCategoryGroup[] = []

export function StorefrontBuyerChrome({
  storeName,
  logoUrl,
  accent = "#7c3aed",
  primary = "#18181b",
  nameBadge = "parallelogram",
  headerBrandAlign = "left",
  categories,
  categoriesSlug,
  totalProducts = 0,
  shopHomePath = "/",
  trust = null,
  isCustomDomain = false,
}: Props) {
  const serverCategories = categories ?? EMPTY_CATEGORIES
  const t = useTranslations("storefront.buyerChrome")
  const cartCount = useBuyerCartCount()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lazyCategories, setLazyCategories] = useState<StorefrontCategoryGroup[] | null>(null)
  const [lazyTotalProducts, setLazyTotalProducts] = useState(0)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const categoriesFetchedRef = useRef(false)

  const drawerCategories =
    serverCategories.length > 0 ? serverCategories : (lazyCategories ?? EMPTY_CATEGORIES)
  const drawerTotalProducts =
    serverCategories.length > 0 ? totalProducts : lazyTotalProducts

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

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
      <div className="sticky top-0 z-[120]">
        <StorefrontBuyerHeader
          storeName={storeName}
          logoUrl={logoUrl}
          accent={accent}
          primary={primary}
          nameBadge={nameBadge}
          headerBrandAlign={headerBrandAlign}
          cartCount={cartCount}
          menuLabel={t("openCategories")}
          cartLabel={t("cart")}
          onOpenMenu={() => setDrawerOpen(true)}
          menuExpanded={drawerOpen}
          menuControlsId="storefront-category-drawer"
          trust={trust}
          isCustomDomain={isCustomDomain}
        />
      </div>

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
