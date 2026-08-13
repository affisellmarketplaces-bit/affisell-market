"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Package, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"

type ResellerStorefrontGridProps = {
  storeSlug: string
  storeLabel: string
  products: ResellerStorefrontListProduct[]
  count: number
}

export function ResellerStorefrontGrid({ storeSlug, storeLabel, products, count }: ResellerStorefrontGridProps) {
  const router = useRouter()

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#faf8ff] text-zinc-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_55%),radial-gradient(80%_60%_at_100%_0%,rgba(20,184,166,0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl"
        aria-hidden
      />

      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">Boutique reseller</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">Boutique {storeLabel}</h1>
              <span className="inline-flex shrink-0 items-center rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-violet-700">
                {count} produit{count > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Powered by Affisell
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100/90 bg-white/90 shadow-sm backdrop-blur-sm transition hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/10"
            >
              <div className="relative aspect-square overflow-hidden border-b border-gray-100/80 bg-gradient-to-br from-violet-50/35 to-teal-50/20">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized={product.image.startsWith("http") || product.image.startsWith("/uploads")}
                />
                {product.isOutOfStock ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 shadow-sm">
                    <Package className="h-3 w-3" aria-hidden />
                    Out of stock
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h2 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-zinc-900">
                  {product.title}
                </h2>
                <p className="mt-2 text-lg font-bold tabular-nums text-violet-700">{product.priceLabel}</p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(`/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(product.id)}`)
                  }
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500"
                >
                  Voir le produit
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
