"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import {
  brandOrbitPillActive,
  brandOrbitPillIdle,
  brandOrbitRailEyebrow,
  brandOrbitRailGlow,
  brandOrbitRailHint,
  brandOrbitRailShell,
} from "@/lib/affisell-brand-orbit-shared"
import { catalogFilterHref, catalogFilterHrefFromParams } from "@/lib/marketplace-catalog-nav.client"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import type { ResolvedBrowseDepartment } from "@/lib/taxonomy/browse-departments-shared"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Props = {
  activeCategoryId: string | null
  catalogBasePath?: string
  className?: string
}

export function MarketplaceBrowseDepartmentsRail({
  activeCategoryId,
  catalogBasePath,
  className,
}: Props) {
  const t = useTranslations("marketplace.browse.browseDepartmentsRail")
  const locale = useLocale()
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const basePath = catalogBasePath ?? pathname

  const { data, isLoading } = useSWR<{ departments: ResolvedBrowseDepartment[] }>(
    `/api/taxonomy/browse-departments?locale=${locale}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  )

  const departments = (data?.departments ?? []).filter((d) => d.resolved)
  if (isLoading || departments.length === 0) return null

  const activeSearch = searchParams.get("q")?.trim() ?? ""
  const visible = departments.slice(0, 8)
  const hasMore = departments.length > 8
  const seeAllHref = catalogFilterHref(basePath)

  return (
    <section className={cn(brandOrbitRailShell, className)} aria-label={t("ariaLabel")}>
      <div className={brandOrbitRailGlow} aria-hidden />
      <div className="relative mb-2 flex flex-wrap items-center gap-2">
        <p className={brandOrbitRailEyebrow}>{t("eyebrow")}</p>
        <p className={cn("hidden sm:inline", brandOrbitRailHint)}>{t("hint")}</p>
      </div>
      <div className="relative flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((dept) => {
          const href = dept.categorySlug
            ? categoryBrowsePath(dept.categorySlug)
            : dept.categoryId
            ? catalogFilterHrefFromParams(
                basePath,
                new URLSearchParams({ category: dept.categoryId })
              )
            : (() => {
                const sp = new URLSearchParams()
                if (dept.searchQuery) sp.set("q", dept.searchQuery)
                return catalogFilterHrefFromParams(basePath, sp)
              })()
          const active = dept.categoryId
            ? activeCategoryId === dept.categoryId
            : Boolean(dept.searchQuery && activeSearch === dept.searchQuery)
          return (
            <Link
              key={dept.id}
              href={href}
              scroll={false}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition",
                active ? brandOrbitPillActive : brandOrbitPillIdle
              )}
              lang={locale}
            >
              <span aria-hidden>{dept.icon}</span>
              {dept.label}
            </Link>
          )
        })}
        {hasMore ? (
          <Link
            href={seeAllHref}
            scroll={false}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition",
              brandOrbitPillIdle
            )}
          >
            {t("seeAll")}
          </Link>
        ) : null}
      </div>
    </section>
  )
}
