"use client"

import { Menu, ShoppingBag, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import { STOREFRONT_OTHER_CATEGORY_ID } from "@/lib/shop-storefront-categories"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  categories: StorefrontCategoryGroup[]
  totalProducts: number
}

export function StorefrontBuyerChrome({
  storeName,
  logoUrl,
  accent = "#7c3aed",
  categories,
  totalProducts,
}: Props) {
  const t = useTranslations("storefront.buyerChrome")
  const cartCount = useBuyerCartCount()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeCategoryId = useMemo(() => {
    const slug = searchParams.get("cat")
    if (!slug) return null
    return categories.find((c) => c.slug === slug)?.id ?? null
  }, [categories, searchParams])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

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

  function pickCategory(categoryId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!categoryId) {
      params.delete("cat")
    } else {
      const slug = categories.find((c) => c.id === categoryId)?.slug
      if (slug) params.set("cat", slug)
      else params.delete("cat")
    }
    const q = params.toString()
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
    closeDrawer()
  }

  return (
    <>
      <div
        className="sticky top-0 z-[120] border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90"
        style={{ borderBottomColor: `color-mix(in srgb, ${accent} 18%, transparent)` }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50 text-zinc-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-600"
            aria-expanded={drawerOpen}
            aria-controls="storefront-category-drawer"
            aria-label={t("openCategories")}
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {storeName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
              {storeName}
            </span>
          </Link>

          <Link
            href="/cart"
            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50 text-zinc-800 transition hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            aria-label={t("cart")}
          >
            <ShoppingBag className="size-5" aria-hidden />
            <CartCountBadge count={cartCount} size="sm" />
          </Link>
        </div>
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
          drawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
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

        <nav className="flex-1 overflow-y-auto p-3" aria-label={t("categoriesAria")}>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => pickCategory(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                  activeCategoryId === null
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                    : "text-zinc-800 hover:bg-violet-50 dark:text-zinc-100 dark:hover:bg-violet-950/40"
                )}
              >
                <span>{t("allProducts")}</span>
                <span className="text-xs opacity-80">{totalProducts}</span>
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => pickCategory(cat.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                    activeCategoryId === cat.id
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                      : "text-zinc-800 hover:bg-violet-50 dark:text-zinc-100 dark:hover:bg-violet-950/40"
                  )}
                >
                  <span aria-hidden>{cat.icon}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {cat.id === STOREFRONT_OTHER_CATEGORY_ID ? t("otherCategory") : cat.name}
                  </span>
                  <span className="text-xs opacity-80">{cat.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
