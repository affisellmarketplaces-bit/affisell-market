import { notFound, redirect } from "next/navigation"

import { BuyerOrderDetailView } from "@/components/account/buyer-order-detail-view"
import { BentoContainer } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { loadBuyerOrderDetail } from "@/lib/buyer-order-detail-load"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function MarketplaceBuyerOrderDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/login/customer?callbackUrl=/marketplace/account/orders")
  }

  const { id } = await params
  const order = await loadBuyerOrderDetail(id, session.user.email)
  if (!order) notFound()

  return (
    <BentoContainer maxWidth="4xl">
      <BuyerOrderDetailView order={order} backHref="/marketplace/account/orders" />
    </BentoContainer>
  )
}
