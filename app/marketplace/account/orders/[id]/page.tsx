import { notFound, redirect } from "next/navigation"

import { BentoContainer } from "@/components/affisell/bento-ui"
import { OrderDetailPanel } from "@/components/legal/order-detail-panel"
import { auth } from "@/auth"
import { orderDetailBackHref, resolveOrderAccessRole } from "@/lib/order-access"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function MarketplaceBuyerOrderDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/marketplace/account/orders")
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      supplier: { select: { store: { select: { showRevenueToAffiliate: true } } } },
    },
  })
  if (!order) notFound()

  const role = resolveOrderAccessRole(order, session.user)
  if (role !== "CUSTOMER") notFound()

  return (
    <BentoContainer maxWidth="4xl">
      <OrderDetailPanel
        order={order}
        role={role}
        backHref={orderDetailBackHref(role)}
        backLabel="← Retour à mes commandes"
        showRevenueToAffiliate={order.supplier.store?.showRevenueToAffiliate ?? false}
      />
    </BentoContainer>
  )
}
