import type { Metadata } from "next"
import { notFound } from "next/navigation"

import MarketplaceListingPage, {
  buildListingMetadataForId,
} from "@/app/marketplace/[id]/page"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ affiliateSlug: string; id: string }>
}): Promise<Metadata> {
  const { affiliateSlug, id } = await params
  return buildListingMetadataForId(id, affiliateSlug)
}

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ affiliateSlug: string; id: string }>
}) {
  const { affiliateSlug, id } = await params
  const match = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      isListed: true,
      product: { active: true },
      affiliate: { role: "AFFILIATE", store: { slug: affiliateSlug } },
    },
    select: { id: true },
  })
  if (!match) notFound()

  return MarketplaceListingPage({ params: Promise.resolve({ id }) })
}
