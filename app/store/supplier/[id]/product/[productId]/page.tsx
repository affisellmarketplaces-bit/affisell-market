import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SupplierAffiliateEvalPreview } from "@/components/supplier/supplier-affiliate-eval-preview"
import { loadSupplierStorefrontCatalogProduct } from "@/lib/supplier-storefront-product-preview"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; productId: string }>
}): Promise<Metadata> {
  const { id: rawSlug, productId: rawProductId } = await params
  const loaded = await loadSupplierStorefrontCatalogProduct({
    storeSlug: decodeURIComponent(rawSlug),
    productId: decodeURIComponent(rawProductId),
  })
  if (!loaded) return { title: "Produit · Affisell" }
  return {
    title: `${loaded.product.name.slice(0, 72)} · ${loaded.store.name}`,
    description:
      "Fiche catalogue partenaires : prix fournisseur, commission et logistique — même lecture que dans Discover Affisell.",
    robots: { index: false, follow: true },
  }
}

export default async function SupplierStorefrontProductCatalogPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>
}) {
  const { id: rawSlug, productId: rawProductId } = await params
  const storeSlug = decodeURIComponent(rawSlug)
  const productId = decodeURIComponent(rawProductId)

  const loaded = await loadSupplierStorefrontCatalogProduct({ storeSlug, productId })
  if (!loaded) notFound()

  const catalogHref = `/store/supplier/${encodeURIComponent(loaded.store.slug)}`

  return (
    <SupplierAffiliateEvalPreview
      product={loaded.product}
      catalogHref={catalogHref}
      listedAffiliateCount={loaded.listedAffiliateCount}
      example={null}
      presentation="storefront-catalog"
      storeName={loaded.store.name}
    />
  )
}
