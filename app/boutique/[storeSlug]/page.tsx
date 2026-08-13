import type { Metadata } from "next"

import {
  formatResellerStoreLabel,
  loadResellerStorefrontProduct,
} from "@/lib/boutique/load-reseller-storefront.server"

import { ResellerStorefrontShell } from "./components/ResellerStorefrontShell"

export const revalidate = 60

type PageProps = {
  params: Promise<{ storeSlug: string }>
  searchParams: Promise<{ productId?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { storeSlug } = await params
  const label = formatResellerStoreLabel(storeSlug)
  return {
    title: `${label} | Boutique Affisell`,
    description: `Découvrez la boutique reseller ${label} propulsée par Affisell.`,
  }
}

export default async function ResellerBoutiquePage({ params, searchParams }: PageProps) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams])
  const requestedListingId = sp.productId?.trim() || null
  const product = await loadResellerStorefrontProduct(requestedListingId)

  return (
    <ResellerStorefrontShell
      storeSlug={storeSlug}
      storeLabel={formatResellerStoreLabel(storeSlug)}
      product={product}
      requestedListingId={requestedListingId}
    />
  )
}
