import Link from "next/link"

import { FeaturedProducts } from "@/components/home/FeaturedProducts"
import { FeaturedShops } from "@/components/home/FeaturedShops"
import { PublicHero } from "@/components/home/PublicHero"
import {
  loadFeaturedProductsCustomerSafe,
  loadFeaturedShopsSafe,
  loadPublicHomeStatsSafe,
} from "@/lib/public-home-data"

export async function PublicHome() {
  const [stats, shops, products] = await Promise.all([
    loadPublicHomeStatsSafe(),
    loadFeaturedShopsSafe(6),
    loadFeaturedProductsCustomerSafe(8),
  ])

  return (
    <main className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
      <PublicHero stats={stats} />

      <section className="space-y-5" aria-labelledby="featured-shops-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Créateurs</p>
            <h2
              id="featured-shops-heading"
              className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Boutiques à la une
            </h2>
          </div>
          <Link
            href="/shops"
            className="text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Voir toutes les boutiques →
          </Link>
        </div>
        <FeaturedShops shops={shops} />
      </section>

      <section className="space-y-5" aria-labelledby="featured-products-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Shopping</p>
          <h2
            id="featured-products-heading"
            className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Produits populaires
          </h2>
        </div>
        <FeaturedProducts products={products} mode="customer" />
      </section>
    </main>
  )
}
