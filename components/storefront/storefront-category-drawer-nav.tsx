"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import type { StorefrontCategoryGroup } from "@/lib/shop-storefront-categories"
import { STOREFRONT_OTHER_CATEGORY_ID } from "@/lib/shop-storefront-categories"
import { cn } from "@/lib/utils"

type Props = {
  categories: StorefrontCategoryGroup[]
  totalProducts: number
  onPickCategory: () => void
}

export function StorefrontCategoryDrawerNav({
  categories,
  totalProducts,
  onPickCategory,
}: Props) {
  const t = useTranslations("storefront.buyerChrome")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCategoryId = useMemo(() => {
    const slug = searchParams.get("cat")
    if (!slug) return null
    return categories.find((c) => c.slug === slug)?.id ?? null
  }, [categories, searchParams])

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
  )
}
