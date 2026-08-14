import type { Metadata } from "next"

import { buildListingMetadataForId } from "@/app/marketplace/[id]/page"
import { redirectAffiliateShopProductToBoutique } from "@/lib/boutique/redirect-affiliate-shop-to-boutique.server"

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}): Promise<Metadata> {
  const { slug, id } = await params
  return buildListingMetadataForId(id, slug)
}

export default async function ShopsProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{
    writeReview?: string
    orderId?: string
    preview?: string
    battleId?: string
    e2eFixtures?: string
    e2eCreatorsWatching?: string
  }>
}) {
  const [{ slug, id }, sp] = await Promise.all([params, searchParams])
  redirectAffiliateShopProductToBoutique(slug, id, sp)
}
