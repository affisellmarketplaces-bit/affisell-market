import type { Metadata } from "next"

import {
  loadResellerBoutiqueStoreContext,
  loadResellerStorefrontList,
  loadResellerStorefrontProduct,
} from "@/lib/boutique/load-reseller-storefront.server"
import { serializeResellerBoutiqueTheme } from "@/lib/boutique/reseller-boutique-theme-shared"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

import { ResellerStorefrontEmptyState } from "@/components/boutique/ResellerStorefrontEmptyState"
import { ResellerStorefrontGrid } from "@/components/boutique/ResellerStorefrontGrid"
import { ResellerStorefrontShell } from "@/components/boutique/ResellerStorefrontShell"

export const revalidate = 60

type PageProps = {
  params: Promise<{ storeSlug: string }>
  searchParams: Promise<{ productId?: string }>
}

const defaultTheme = serializeResellerBoutiqueTheme(parseStorefrontTheme(null))

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const storeContext = await loadResellerBoutiqueStoreContext(storeSlug)
  const label = storeContext?.storeLabel ?? formatResellerStoreLabel(storeSlug)
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

export default async function ResellerBoutiquePage({ params, searchParams }: PageProps) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const requestedListingId = sp.productId?.trim() || null

  const storeContext = await loadResellerBoutiqueStoreContext(storeSlug)
  const storeLabel = storeContext?.storeLabel ?? formatResellerStoreLabel(storeSlug)
  const theme = storeContext?.theme ?? defaultTheme

  if (requestedListingId) {
    const product = await loadResellerStorefrontProduct(requestedListingId)
    return (
      <ResellerStorefrontShell
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        theme={theme}
        product={product}
        requestedListingId={requestedListingId}
      />
    )
  }

  const storefront = await loadResellerStorefrontList({ storeSlug })
  const resolvedTheme = storefront.theme ?? theme

  if (storefront.count === 0) {
    return (
      <ResellerStorefrontEmptyState
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        theme={resolvedTheme}
      />
    )
  }

  return (
    <ResellerStorefrontGrid
      storeSlug={storeSlug}
      storeLabel={storeLabel}
      theme={resolvedTheme}
      products={storefront.products}
      count={storefront.count}
    />
  )
}
