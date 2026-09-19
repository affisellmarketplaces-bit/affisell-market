"use client"

import { LayoutGrid } from "lucide-react"
import { useTranslations } from "next-intl"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import {
  PREMIUM_MARKETPLACE_HOME,
  type PremiumCategoryItem,
} from "@/lib/marketplace-premium-home-shared"
import { CATEGORY_PILL_BAND, categoryPillClass, categoryPillIconClass } from "@/lib/category-pill-style"
import { cn } from "@/lib/utils"

type Props = {
  categories: PremiumCategoryItem[]
  catalogTotal: number
  activeCategoryId: string | null
  catalogBasePath?: string
  className?: string
}

export function DepartmentBar({
  categories,
  catalogTotal,
  activeCategoryId,
  catalogBasePath = "/",
  className,
}: Props) {
  const t = useTranslations("marketplace.departmentsBar")
  const allActive = !activeCategoryId

  return (
    <section
      className={cn(
        CATEGORY_PILL_BAND,
        "rounded-2xl border border-white/60 p-3 shadow-[0_8px_32px_-12px_rgba(76,29,149,0.22)]",
        className
      )}
      aria-label={t("title")}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#F3E8FF", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
          >
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <div>
            <p
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
            >
              {t("title")}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] normal-case tracking-normal"
                style={{ backgroundColor: "#F3E8FF", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
              >
                {categories.length}
              </span>
            </p>
            <p className="text-xs leading-snug" style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsHint }}>
              {t("hint")}
            </p>
          </div>
        </div>
      </div>

      <ScrollFadeRow ariaLabel={t("title")}>
        <FastLink
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className={categoryPillClass(allActive)}
        >
          {t("all")}
          <span className={allActive ? "text-white/80" : "text-[#03020F]/55"}>{catalogTotal}</span>
        </FastLink>

        {categories.map((cat) => {
          const active = activeCategoryId === cat.id
          return (
            <FastLink
              key={cat.id}
              href={categoryRailHref(catalogBasePath, cat)}
              scroll={false}
              className={categoryPillClass(active)}
            >
              <CategoryGlyph
                name={cat.name}
                slug={cat.slug}
                icon={cat.icon}
                size="lg"
                tone="bare"
                className={categoryPillIconClass(active)}
              />
              {cat.name}
            </FastLink>
          )
        })}
      </ScrollFadeRow>
    </section>
  )
}
