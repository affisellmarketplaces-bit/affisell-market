import { notFound } from "next/navigation"

import { ViralCommandCenter } from "@/components/social/ViralCommandCenter"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ format?: string }>
}

export default async function ResellerProductSocialPage({ params, searchParams }: Props) {
  const { id } = await params
  const { format } = await searchParams
  const session = await requireAffiliateSession(`/dashboard/reseller/products/${id}/social`)
  const product = await loadBubbleProductView(id, session.user.id)
  if (!product) notFound()

  return (
    <ViralCommandCenter
      initialFormat={format ?? null}
      product={{
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        medias: product.medias,
        salePrice: product.salePrice,
        compareAtPrice: product.compareAtPrice,
        marginEuro: product.marginEuro,
        costPrice: product.costPrice,
        deliveryDays: product.deliveryDays,
        deliveryCountry: product.deliveryCountry,
        supplierTrustScore: product.supplierTrustScore,
        bubbleUrl: product.bubbleUrl,
        listingId: product.listingId,
        storeSlug: product.storeSlug,
        storeName: product.storeName,
        boutiqueUrl: product.boutiqueUrl,
        boutiqueHostLabel: product.boutiqueHostLabel,
      }}
    />
  )
}
