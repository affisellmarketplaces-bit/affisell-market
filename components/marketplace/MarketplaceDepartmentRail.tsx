"use client"

import Link from "next/link"
import useSWR from "swr"
import { Sparkles } from "lucide-react"

import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Cat = { id: string; name: string; icon: string; slug: string; order: number }

export function MarketplaceDepartmentRail({
  activeCategoryId,
  activeSubcategoryId,
  catalogBasePath = PUBLIC_MARKETPLACE_BROWSE_PATH,
}: {
  activeCategoryId: string | null
  activeSubcategoryId: string | null
  catalogBasePath?: string
}) {
  const { data, isLoading } = useSWR<{ categories: Cat[] }>("/api/categories", fetcher, {
    refreshInterval: 300_000,
  })

  if (isLoading || !data?.categories?.length) return null

  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/95 via-white to-fuchsia-50/80 p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/30"
      aria-label="Rayons Affisell"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <Sparkles className="size-3" aria-hidden />
          Rayons
        </span>
        <p className="text-xs font-medium text-violet-950/80 dark:text-violet-100/85">
          Navigation type grand comptoir — chaque rayon ouvre ses allées dans la colonne de gauche.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={catalogBasePath}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
            !activeCategoryId && !activeSubcategoryId
              ? "border-violet-500 bg-violet-600 text-white shadow-md"
              : "border-zinc-200/80 bg-white/90 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
          )}
        >
          Tout le catalogue
        </Link>
        {data.categories.map((c) => {
          const on = activeCategoryId === c.id && !activeSubcategoryId
          return (
            <Link
              key={c.id}
              href={`${catalogBasePath}?category=${encodeURIComponent(c.id)}`}
              className={cn(
                affisellBrand.quickLink,
                "affisell-quick-link--buyer shrink-0 !rounded-full !py-1.5 text-xs",
                on ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-violet-50 dark:ring-offset-zinc-950" : ""
              )}
            >
              <span className={affisellBrand.quickLinkIconBuyer}>
                <span className="text-base leading-none">{c.icon}</span>
              </span>
              <span className="max-w-[10rem] truncate">{c.name}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
