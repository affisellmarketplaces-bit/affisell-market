"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"

import { catalogFilterHref, catalogFilterHrefFromParams } from "@/lib/marketplace-catalog-nav.client"
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

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-white to-indigo-50/80 p-3 shadow-sm dark:border-sky-900/40 dark:from-sky-950/30 dark:via-zinc-950 dark:to-indigo-950/20",
        className
      )}
      aria-label={t("ariaLabel")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(14,165,233,0.1),transparent)]" />
      <div className="relative mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-800/80 dark:text-sky-300/80">
          {t("eyebrow")}
        </p>
        <p className="hidden text-[11px] text-sky-900/70 sm:inline dark:text-sky-200/70">{t("hint")}</p>
      </div>
      <div className="relative flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {departments.map((dept) => {
          const href = dept.categoryId
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
                active
                  ? "border-sky-500 bg-sky-600 text-white shadow-md shadow-sky-500/25"
                  : "border-white/80 bg-white/70 text-zinc-700 hover:border-sky-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-sky-700"
              )}
              lang={locale}
            >
              <span aria-hidden>{dept.icon}</span>
              {dept.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
