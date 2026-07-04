import { notFound } from "next/navigation"

import { StorefrontEmbedView } from "@/components/storefront/storefront-embed-view"
import {
  loadAffiliateShopProductsCached,
  loadAffiliateShopStoreCached,
} from "@/lib/shop-storefront-cache"

export const revalidate = 60

export default async function ShopEmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [store, products] = await Promise.all([
    loadAffiliateShopStoreCached(slug),
    loadAffiliateShopProductsCached(slug),
  ])
  if (!store) notFound()
  if (!store.theme.embedWidget?.enabled) notFound()

  return <StorefrontEmbedView store={store} products={products} />
}
