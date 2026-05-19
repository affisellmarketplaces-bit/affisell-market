import Link from "next/link"

import { HeroSearchBar } from "@/components/home/HeroSearchBar"
import { buttonVariants } from "@/components/ui/button"
import type { PublicHomeStats } from "@/lib/public-home-data"
import { cn } from "@/lib/utils"

type Props = {
  stats: PublicHomeStats
}

export function PublicHero({ stats }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-violet-700 to-teal-700 px-6 py-12 text-white shadow-lg sm:px-10 sm:py-16">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Les boutiques créées par vos créateurs préférés
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-violet-100/95 sm:text-base">
          Livraison 2-7j · Paiement sécurisé · Support FR · {stats.productCountLabel} produits en boutique
        </p>
        <div className="mx-auto mt-6 max-w-xl">
          <HeroSearchBar className="[&_input]:border-white/30 [&_input]:bg-white/95 [&_button]:bg-zinc-900 [&_button]:hover:bg-zinc-800" />
        </div>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/shops"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-white text-violet-900 hover:bg-violet-50"
            )}
          >
            Découvrir les boutiques →
          </Link>
          <Link
            href="/signup/affiliate"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "border-white/40 bg-transparent text-white hover:bg-white/10"
            )}
          >
            Je suis créateur
          </Link>
        </div>
        <p className="mt-4">
          <Link
            href="/signup/supplier"
            className="text-sm font-medium text-violet-100/95 underline-offset-2 hover:underline"
          >
            Je suis fournisseur →
          </Link>
        </p>
        <p className="mt-6 text-sm font-medium tabular-nums text-violet-100/90">
          {stats.shopCountLabel} boutiques créateurs · {stats.productCountLabel} produits
        </p>
      </div>
    </section>
  )
}
