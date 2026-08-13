import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react"

import {
  type ResellerStorefrontProduct,
} from "@/lib/boutique/load-reseller-storefront.server"

type ResellerStorefrontShellProps = {
  storeSlug: string
  storeLabel: string
  product: ResellerStorefrontProduct | null
  requestedListingId: string | null
}

export function ResellerStorefrontShell({
  storeSlug,
  storeLabel,
  product,
  requestedListingId,
}: ResellerStorefrontShellProps) {
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
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{storeLabel}</h1>
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
        {!product ? (
          <section className="mx-auto max-w-2xl rounded-[1.75rem] border border-violet-200/50 bg-white/85 p-10 text-center shadow-[0_24px_80px_-32px_rgba(91,33,217,0.35)] backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{storeLabel}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {requestedListingId
                ? "Ce produit n'est pas disponible ou l'identifiant listing est invalide."
                : "Ajoute ?productId=TON_LISTING_ID à l'URL pour afficher ton produit phare."}
            </p>
            {requestedListingId ? (
              <p className="mt-2 font-mono text-xs text-zinc-400">listing: {requestedListingId}</p>
            ) : (
              <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 font-mono text-[11px] text-violet-800">
                /boutique/{storeSlug}?productId=&lt;AffiliateProduct.id&gt;
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard/affiliate"
                className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500"
              >
                Ouvrir mon dashboard
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:border-violet-200 hover:bg-violet-50/60"
              >
                Explorer le marketplace
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_28px_90px_-36px_rgba(91,33,217,0.45)] ring-1 ring-violet-500/10">
              <div className="relative aspect-square bg-gradient-to-br from-violet-50 via-white to-teal-50">
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 560px"
                  priority
                  unoptimized={
                    product.imageUrl.startsWith("http") || product.imageUrl.startsWith("/uploads")
                  }
                />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-violet-200/40 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Produit phare</p>
              <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                {product.title}
              </h2>
              <p className="mt-4 text-3xl font-bold tabular-nums text-violet-700">{product.priceLabel}</p>
              {product.descriptionExcerpt ? (
                <p className="mt-5 text-sm leading-relaxed text-zinc-600">{product.descriptionExcerpt}</p>
              ) : null}

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-xs font-medium text-zinc-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                  Paiement sécurisé Affisell
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-xs font-medium text-zinc-700">
                  <Truck className="h-4 w-4 text-violet-600" aria-hidden />
                  Checkout marketplace intégré
                </div>
              </div>

              <Link
                href={product.marketplaceHref}
                className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 text-base font-bold text-white shadow-[0_16px_40px_-16px_rgba(91,33,217,0.65)] transition hover:from-violet-500 hover:to-indigo-500"
              >
                Acheter maintenant
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="mt-3 text-center text-[11px] text-zinc-500">
                Tu seras redirigé vers le checkout Affisell pour finaliser la commande.
              </p>
            </div>
          </section>
        )}

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-violet-100/80 pt-6 text-xs text-zinc-500">
          <span>Boutique `{storeSlug}` · Affisell Reseller v1</span>
          <Link href="/marketplace" className="font-semibold text-violet-700 hover:text-violet-900">
            Marketplace →
          </Link>
        </footer>
      </main>
    </div>
  )
}
