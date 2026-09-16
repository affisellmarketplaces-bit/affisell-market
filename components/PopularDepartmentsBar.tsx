"use client"

import { ArrowRight } from "lucide-react"
import { useLocale } from "next-intl"
import useSWR from "swr"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
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
    <section className={cn("rounded-2xl bg-white px-3 py-3 shadow-sm", className)} aria-label="Popular departments">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.14em]"
            style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
          >
            Popular departments
          </p>
          <p className="text-xs" style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsHint }}>
            Familiar labels — each opens the matching Google taxonomy aisle
          </p>
        </div>
        <FastLink
          href={catalogFilterHref(catalogBasePath)}
          scroll={false}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition hover:opacity-80"
          style={{ color: PREMIUM_MARKETPLACE_HOME.departmentsLabel }}
        >
          See all
          <ArrowRight className="size-3.5" aria-hidden />
        </FastLink>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((dept) => {
          const active = dept.categoryId ? activeCategoryId === dept.categoryId : false
          const style = resolveBrowseDepartmentPillStyle(dept.id)
          return (
            <FastLink
              key={dept.id}
              href={browseDepartmentRailHref(catalogBasePath, dept)}
              scroll={!softNav}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition",
                active && "ring-2 ring-violet-400 ring-offset-1"
              )}
              style={
                active
                  ? { backgroundImage: PREMIUM_MARKETPLACE_HOME.heroGradient, color: "#fff" }
                  : { backgroundColor: style.bg, color: style.text }
              }
              lang={locale}
            >
              <CategoryGlyph name={dept.label} icon={dept.icon} size="xs" />
              {dept.label}
            </FastLink>
          )
        })}
      </div>
    </section>
  )
}
