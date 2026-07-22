import { notFound } from "next/navigation"

import { ViralCommandCenter } from "@/components/social/ViralCommandCenter"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"

type Props = { params: Promise<{ id: string }> }

export default async function ResellerProductSocialPage({ params }: Props) {
  await requireAffiliateSession(`/dashboard/reseller/products/${(await params).id}/social`)
  const { id } = await params
  const product = await loadBubbleProductView(id)
  if (!product) notFound()

  return (
    <ViralCommandCenter
      product={{
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        salePrice: product.salePrice,
        compareAtPrice: product.compareAtPrice,
        marginEuro: product.marginEuro,
        deliveryDays: product.deliveryDays,
        deliveryCountry: product.deliveryCountry,
        supplierTrustScore: product.supplierTrustScore,
        bubbleUrl: product.bubbleUrl,
      }}
    />
  )
}
