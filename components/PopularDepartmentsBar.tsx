"use client"

import { ArrowRight } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import {
  browseDepartmentRailHref,
  isSoftCategoryCatalogBase,
} from "@/lib/marketplace-category-rail-href.client"
import { PREMIUM_MARKETPLACE_HOME, resolveBrowseDepartmentPillStyle } from "@/lib/marketplace-premium-home-shared"
import type { ResolvedBrowseDepartment } from "@/lib/taxonomy/browse-departments-shared"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Props = {
  activeCategoryId: string | null
  catalogBasePath?: string
  initialDepartments?: ResolvedBrowseDepartment[]
  className?: string
}

export function PopularDepartmentsBar({
  activeCategoryId,
  catalogBasePath = "/",
  initialDepartments,
  className,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("marketplace.departmentsBar")
  const { data } = useSWR<{ departments: ResolvedBrowseDepartment[] }>(
    initialDepartments ? null : `/api/taxonomy/browse-departments?locale=${locale}`,
    fetcher,
    {
      fallbackData: initialDepartments ? { departments: initialDepartments } : undefined,
      revalidateOnFocus: false,
    }
  )

  const departments = (data?.departments ?? []).filter((d) => d.resolved)
  if (departments.length === 0) return null

  const visible = departments.slice(0, 10)
  const softNav = isSoftCategoryCatalogBase(catalogBasePath)

  return (
    <section className={cn(
        "rounded-2xl border border-white/70 bg-white/55 px-3 py-3 shadow-[0_8px_32px_-12px_rgba(76,29,149,0.22),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150",
        className
      )}
      aria-label={t("popularTitle")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]"
            style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
          >
            {t("popularTitle")}
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] normal-case tracking-normal"
              style={{ backgroundColor: "#F3E8FF", color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
            >
              {visible.length}/{departments.length}
            </span>
          </p>
          <p className="text-xs" style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsHint }}>
            {t("popularHint")}
          </p>
        </div>
        <FastLink
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition hover:opacity-80"
          style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
        >
          {t("seeAll")}
          <ArrowRight className="size-3.5" aria-hidden />
        </FastLink>
      </div>

      <ScrollFadeRow ariaLabel={t("popularTitle")}>
        {visible.map((dept) => {
          const active = dept.categoryId ? activeCategoryId === dept.categoryId : false
          const style = resolveBrowseDepartmentPillStyle(dept.id)
          return (
            <FastLink
              key={dept.id}
              href={browseDepartmentRailHref(catalogBasePath, dept)}
              scroll={!softNav}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ring-white/70 transition hover:-translate-y-px hover:shadow-md",
                active && "ring-2 ring-violet-400 ring-offset-1"
              )}
              style={
                active
                  ? { backgroundImage: PREMIUM_MARKETPLACE_HOME.heroGradient, color: "#fff" }
                  : { backgroundColor: `color-mix(in srgb, ${style.bg} 70%, transparent)`, color: style.text }
              }
              lang={locale}
            >
              <CategoryGlyph name={dept.label} icon={dept.icon} size="md" />
              {dept.label}
            </FastLink>
          )
        })}
      </ScrollFadeRow>
    </section>
  )
}
