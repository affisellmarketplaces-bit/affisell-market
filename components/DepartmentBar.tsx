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
        "rounded-2xl border border-white/70 bg-white/55 p-3 shadow-[0_8px_32px_-12px_rgba(76,29,149,0.25),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150",
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
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white transition",
            allActive ? "shadow-md" : "opacity-90 hover:opacity-100"
          )}
          style={{ backgroundColor: PREMIUM_MARKETPLACE_HOME.conditionActive }}
        >
          {t("all")}
          <span className="opacity-90">({catalogTotal})</span>
        </FastLink>

        {categories.map((cat) => {
          const active = activeCategoryId === cat.id
          return (
            <FastLink
              key={cat.id}
              href={categoryRailHref(catalogBasePath, cat)}
              scroll={false}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-zinc-800 backdrop-blur-md transition hover:-translate-y-px hover:shadow-md",
                active
                  ? "bg-violet-50/90 ring-2 ring-violet-500"
                  : "bg-white/70 ring-1 ring-violet-200/60 hover:bg-white/90 hover:ring-violet-300"
              )}
            >
              <CategoryGlyph name={cat.name} slug={cat.slug} icon={cat.icon} size="md" tone="soft" />
              {cat.name}
              {cat.count > 0 ? (
                <span className="text-[11px] font-medium tabular-nums text-zinc-500">{cat.count}</span>
              ) : null}
            </FastLink>
          )
        })}
      </ScrollFadeRow>
    </section>
  )
}
