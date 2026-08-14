"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { ResellerBoutiqueBuyerHeader } from "@/components/boutique/reseller-boutique-buyer-header"
import { StorefrontCategoryDrawerNav } from "@/components/storefront/storefront-category-drawer-nav"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  shopHomePath: string
  categoriesSlug: string
  trust: StorefrontTrustSnapshot | null
  ownerDashboardHref?: string | null
}

const EMPTY_CATEGORIES: StorefrontCategoryGroup[] = []

export function ResellerBoutiqueBuyerChrome({
  storeName,
  logoUrl,
  shopHomePath,
  categoriesSlug,
  trust,
  ownerDashboardHref,
}: Props) {
  const t = useTranslations("storefront.buyerChrome")
  const cartCount = useBuyerCartCount({ deferSync: true })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lazyCategories, setLazyCategories] = useState<StorefrontCategoryGroup[] | null>(null)
  const [lazyTotalProducts, setLazyTotalProducts] = useState(0)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const categoriesFetchedRef = useRef(false)

  const drawerCategories = lazyCategories ?? EMPTY_CATEGORIES
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    categoriesFetchedRef.current = false
    setLazyCategories(null)
    setLazyTotalProducts(0)
  }, [categoriesSlug])

  useEffect(() => {
    if (!drawerOpen || !categoriesSlug || categoriesFetchedRef.current) return
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
  }, [categoriesSlug, drawerOpen])

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
      <ResellerBoutiqueBuyerHeader
        storeName={storeName}
        logoUrl={logoUrl}
        shopHomePath={shopHomePath}
        cartCount={cartCount}
        menuLabel={t("openCategories")}
        cartLabel={t("cart")}
        onOpenMenu={() => setDrawerOpen(true)}
        menuExpanded={drawerOpen}
        menuControlsId="boutique-category-drawer"
        trust={trust}
        ownerDashboardHref={ownerDashboardHref}
      />

      {drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[130] bg-zinc-950/45 backdrop-blur-[2px]"
          aria-label={t("closeCategories")}
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        id="boutique-category-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-[140] flex w-[min(100vw-3rem,22rem)] flex-col border-r shadow-2xl transition-transform duration-300",
          "border-[var(--boutique-card-border,rgba(255,255,255,0.2))] bg-[var(--boutique-card-bg,#fff)]",
          drawerOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-4"
          style={{
            borderColor: "var(--boutique-card-border, rgba(0,0,0,0.08))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--boutique-accent, #7c3aed) 10%, white), transparent)",
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              {t("drawerEyebrow")}
            </p>
            <p className="text-sm font-bold text-zinc-900">{storeName}</p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white"
            aria-label={t("closeCategories")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <Suspense
          fallback={
            <div className="flex-1 animate-pulse p-3">
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/80" />
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/60" />
              <div className="h-10 rounded-xl bg-zinc-200/40" />
            </div>
          }
        >
          {categoriesLoading && drawerCategories.length === 0 ? (
            <div className="flex-1 animate-pulse p-3" aria-busy="true">
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/80" />
              <div className="mb-2 h-10 rounded-xl bg-zinc-200/60" />
              <div className="h-10 rounded-xl bg-zinc-200/40" />
            </div>
          ) : (
            <StorefrontCategoryDrawerNav
              categories={drawerCategories}
              totalProducts={lazyTotalProducts}
              shopHomePath={shopHomePath}
              onPickCategory={closeDrawer}
            />
          )}
        </Suspense>
      </aside>
    </>
  )
}
