import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

import { loadPublicAffiliateShops } from "@/lib/shop-storefront-data"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Boutiques créateurs",
  description: "Parcourez les boutiques Affisell des créateurs affiliés.",
}

export default async function ShopsDirectoryPage() {
  const shops = await loadPublicAffiliateShops()

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Boutiques créateurs
        </h1>
        <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Achetez directement auprès des créateurs — sans données affilié sur les fiches produit.
        </p>
      </header>

      {shops.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune boutique publique pour le moment.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <li key={shop.slug}>
              <Link
                href={`/shop/${shop.slug}`}
                className="flex items-center gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm transition hover:border-violet-200 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-800"
              >
                {shop.logoUrl ? (
                  <Image
                    src={shop.logoUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-xl object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                    {shop.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{shop.name}</p>
                  <p className="text-xs text-zinc-500">Boutique {shop.nicheLabel}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
