import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductGrid } from "@/components/shop/ProductGrid"
import {
  loadAffiliateShopProducts,
  loadAffiliateShopStore,
} from "@/lib/shop-storefront-data"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ affiliateSlug: string }>
}): Promise<Metadata> {
  const { affiliateSlug } = await params
  const store = await loadAffiliateShopStore(affiliateSlug)
  if (!store) return { title: "Boutique" }
  return {
    title: `${store.name} - Boutique ${store.nicheLabel}`,
    description:
      store.description?.slice(0, 160) ??
      `Découvrez la sélection ${store.nicheLabel} de ${store.name}.`,
  }
}

export default async function ShopAffiliatePage({
  params,
}: {
  params: Promise<{ affiliateSlug: string }>
}) {
  const { affiliateSlug } = await params
  const store = await prisma.store.findUnique({
    where: { slug: affiliateSlug },
    select: { userId: true, user: { select: { role: true } } },
  })
  if (!store || store.user.role !== "AFFILIATE") notFound()

  const products = await loadAffiliateShopProducts(store.userId)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <ProductGrid affiliateSlug={affiliateSlug} products={products} />
    </div>
  )
}
