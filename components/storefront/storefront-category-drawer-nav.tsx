"use client"

import { LayoutGrid } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import { STOREFRONT_OTHER_CATEGORY_ID } from "@/lib/shop-storefront-categories"
import { cn } from "@/lib/utils"

type Props = {
  categories: StorefrontCategoryGroup[]
  totalProducts: number
  shopHomePath?: string
  onPickCategory: () => void
}

export function StorefrontCategoryDrawerNav({
  categories,
  totalProducts,
  shopHomePath = "/",
  onPickCategory,
}: Props) {
  const t = useTranslations("storefront.buyerChrome")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onShopHome = pathname === shopHomePath

  const activeCategoryId = useMemo(() => {
    if (!onShopHome) return null
    const slug = searchParams.get("cat")
    if (!slug) return null
    return categories.find((c) => c.slug === slug)?.id ?? null
  }, [categories, onShopHome, searchParams])

  function pickCategory(categoryId: string | null) {
    const params = new URLSearchParams(onShopHome ? searchParams.toString() : "")
    if (!categoryId) {
      params.delete("cat")
    } else {
      const slug = categories.find((c) => c.id === categoryId)?.slug
      if (slug) params.set("cat", slug)
      else params.delete("cat")
    }
    const q = params.toString()
    const targetPath = onShopHome ? shopHomePath : shopHomePath
    router.push(q ? `${targetPath}?${q}` : targetPath, { scroll: false })
    onPickCategory()
  }

  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label={t("categoriesAria")}>
      <ul className="space-y-1">
        <li>
          <button
            type="button"
            onClick={() => pickCategory(null)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
              activeCategoryId === null
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                : "text-zinc-800 hover:bg-violet-50 dark:text-zinc-100 dark:hover:bg-violet-950/40"
            )}
          >
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
                activeCategoryId === null
                  ? "bg-white/20 ring-white/30"
                  : "bg-violet-100 ring-violet-200/80 dark:bg-violet-950/50 dark:ring-violet-800/60"
              )}
              aria-hidden
            >
              <LayoutGrid
                className={cn(
                  "size-3.5",
                  activeCategoryId === null ? "text-white" : "text-violet-700 dark:text-violet-300"
                )}
                strokeWidth={2.25}
              />
            </span>
            <span className="min-w-0 flex-1">{t("allProducts")}</span>
            <span className="text-xs opacity-80">{totalProducts}</span>
          </button>
        </li>
        {categories.map((cat) => (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => pickCategory(cat.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                activeCategoryId === cat.id
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                  : "text-zinc-800 hover:bg-violet-50 dark:text-zinc-100 dark:hover:bg-violet-950/40"
              )}
            >
              <CategoryGlyph
                name={cat.id === STOREFRONT_OTHER_CATEGORY_ID ? t("otherCategory") : cat.name}
                slug={cat.slug}
                size="sm"
                className={activeCategoryId === cat.id ? "ring-white/40" : undefined}
              />
              <span className="min-w-0 flex-1 truncate">
                {cat.id === STOREFRONT_OTHER_CATEGORY_ID ? t("otherCategory") : cat.name}
              </span>
              <span className="text-xs opacity-80">{cat.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
