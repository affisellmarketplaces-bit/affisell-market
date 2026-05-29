import { MarketplaceSearchBox } from "@/components/marketplace/MarketplaceSearchBox"
import type { HomeMarketplaceStats } from "@/lib/home-marketplace-cards"

type Props = {
  stats: HomeMarketplaceStats
}

export function Hero({ stats }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-teal-50/40 px-6 py-10 shadow-sm dark:border-violet-900/40 dark:from-violet-950/50 dark:via-zinc-950 dark:to-teal-950/20 sm:px-10 sm:py-12">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl">
          Les produits qui rapportent, prêts à revendre
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          Parcourez le catalogue Affisell, comparez marges et délais — comme sur une marketplace
          pro, pensée pour les créateurs affiliés.
        </p>
        <div className="mt-8 w-full">
          <MarketplaceSearchBox className="mx-auto" />
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
        </p>
      </div>
    </section>
  )
}
