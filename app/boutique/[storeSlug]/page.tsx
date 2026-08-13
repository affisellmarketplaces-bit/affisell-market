import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles } from "lucide-react"

import {
  loadResellerStorefrontList,
  loadResellerStorefrontProduct,
} from "@/lib/boutique/load-reseller-storefront.server"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"

import { ResellerStorefrontGrid } from "@/components/boutique/ResellerStorefrontGrid"
import { ResellerStorefrontShell } from "@/components/boutique/ResellerStorefrontShell"

export const revalidate = 60

type PageProps = {
  params: Promise<{ storeSlug: string }>
  searchParams: Promise<{ productId?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const label = formatResellerStoreLabel(storeSlug)
  const listingId = sp.productId?.trim() || null
  const product = listingId ? await loadResellerStorefrontProduct(listingId) : null

  if (product) {
    return {
      title: `${product.title} | ${label}`,
      description: product.descriptionExcerpt || `Achetez ${product.title} sur la boutique ${label}.`,
      openGraph: {
        title: `${product.title} · ${label}`,
        description: product.descriptionExcerpt,
        images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
      },
    }
  }

  const storefront = listingId ? null : await loadResellerStorefrontList({ storeSlug })
  const productCount = storefront?.count ?? 0

  return {
    title: `${label} | Boutique Affisell`,
    description:
      productCount > 0
        ? `Découvrez ${productCount} produit${productCount > 1 ? "s" : ""} sur la boutique reseller ${label}.`
        : `Découvrez la boutique reseller ${label} propulsée par Affisell.`,
  }
}

function ResellerStorefrontEmptyState({
  storeSlug,
  storeLabel,
}: {
  storeSlug: string
  storeLabel: string
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#faf8ff] text-zinc-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_55%)]"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-[1.75rem] border border-violet-200/50 bg-white/85 p-10 text-center shadow-[0_24px_80px_-32px_rgba(91,33,217,0.35)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Boutique {storeLabel}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Boutique vide — ajoute depuis{" "}
            <Link href="/dashboard/affiliate" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
              /dashboard/affiliate
            </Link>
          </p>
          <p className="mt-2 font-mono text-[11px] text-zinc-400">/boutique/{storeSlug}</p>
        </section>
      </main>
    </div>
  )
}

export default async function ResellerBoutiquePage({ params, searchParams }: PageProps) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const requestedListingId = sp.productId?.trim() || null
  const storeLabel = formatResellerStoreLabel(storeSlug)

  if (requestedListingId) {
    const product = await loadResellerStorefrontProduct(requestedListingId)
    return (
      <ResellerStorefrontShell
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        product={product}
        requestedListingId={requestedListingId}
      />
    )
  }

  const storefront = await loadResellerStorefrontList({ storeSlug })

  if (storefront.count === 0) {
    return <ResellerStorefrontEmptyState storeSlug={storeSlug} storeLabel={storeLabel} />
  }

  return <ResellerStorefrontGrid storeSlug={storeSlug} storeLabel={storeLabel} products={storefront.products} count={storefront.count} />
}
