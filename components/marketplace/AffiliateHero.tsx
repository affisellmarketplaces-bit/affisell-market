import Link from "next/link"

import { MarketplaceSearchBox } from "@/components/marketplace/MarketplaceSearchBox"
import type { HomeMarketplaceStats } from "@/lib/home-marketplace-cards"
import { cn } from "@/lib/utils"

const NICHE_LINKS = [
  { label: "Fitness", href: "/dashboard/affiliate/catalog?niche=fitness" },
  { label: "Tech", href: "/dashboard/affiliate/catalog?niche=tech" },
  { label: "Maison", href: "/dashboard/affiliate/catalog?niche=maison" },
] as const

type Props = {
  stats: HomeMarketplaceStats
}

export function AffiliateHero({ stats }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-teal-50/40 px-6 py-10 shadow-sm dark:border-violet-900/40 dark:from-violet-950/50 dark:via-zinc-950 dark:to-teal-950/20 sm:px-10 sm:py-12">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl md:text-6xl">
          Les produits qui rapportent, prêts à add to your vitrine store
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          Filtrez par rayon ou domaine, explorez les tendances, puis publiez chaque SKU sur votre boutique vitrine en un clic.
        </p>
        <div className="mt-8 w-full">
          <MarketplaceSearchBox className="mx-auto" basePath="/dashboard/affiliate/catalog" />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {NICHE_LINKS.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={cn(
                "rounded-full border border-violet-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50 dark:border-violet-800/60 dark:bg-zinc-900/80 dark:text-violet-200 dark:hover:bg-violet-950/50"
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-900 dark:text-zinc-100">{stats.productCountLabel} produits</span>
          <span aria-hidden className="mx-2 text-zinc-300 dark:text-zinc-600">
            ·
          </span>
          <span>
            Comm. moyenne{" "}
            <span className="text-violet-700 dark:text-violet-300">{stats.avgCommissionLabel}</span>
          </span>
          <span aria-hidden className="mx-2 text-zinc-300 dark:text-zinc-600">
            ·
          </span>
          <span>Livraison 2-7j</span>
        </p>
      </div>
    </section>
  )
}
