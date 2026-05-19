import Link from "next/link"

import { HomeBuyerSmartStrip } from "@/components/home/HomeBuyerSmartStrip"
import { HeroSearchBar } from "@/components/home/HeroSearchBar"
import { buttonVariants } from "@/components/ui/button"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"
import { cn } from "@/lib/utils"

type Props = {
  featuredShops: PublicShopDirectoryEntry[]
}

export function PublicHero({ featuredShops }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-violet-700 to-teal-700 px-4 py-10 text-white shadow-lg sm:px-8 sm:py-12 md:px-10 md:py-14">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Les boutiques créées par vos créateurs préférés
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-violet-100/95 sm:text-base">
          Livraison 2-7j · Paiement sécurisé · Support
        </p>
        <div className="mx-auto mt-6 max-w-xl">
          <HeroSearchBar
            className="[&_input]:border-white/30 [&_input]:bg-white/95 [&_button]:bg-zinc-900 [&_button]:hover:bg-zinc-800"
            catalogPath="/"
          />
        </div>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/#explorer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-white text-violet-900 hover:bg-violet-50"
            )}
          >
            Explorer le catalogue
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
            Je suis fournisseur
          </Link>
        </p>
        <HomeBuyerSmartStrip featuredShops={featuredShops} />
      </div>
    </section>
  )
}
