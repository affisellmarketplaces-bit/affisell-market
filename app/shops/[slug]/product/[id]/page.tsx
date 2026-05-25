import type { Metadata } from "next"

import MarketplaceListingPage, {
  buildListingMetadataForId,
} from "@/app/marketplace/[id]/page"

/** Shop PDP — ISR 60s (same listing shell as marketplace, scoped by store slug). */
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
  searchParams: Promise<{ writeReview?: string; orderId?: string }>
}) {
  const { slug, id } = await params
  return MarketplaceListingPage({
    params: Promise.resolve({ id }),
    searchParams,
    storeSlug: slug,
  })
}
