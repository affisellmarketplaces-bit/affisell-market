import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { OrderDetailPanel } from "@/components/legal/order-detail-panel"
import { auth } from "@/auth"
import { orderDetailBackHref, resolveOrderAccessRole } from "@/lib/order-access"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function DashboardOrderDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/orders")

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      supplier: { select: { id: true, store: { select: { showRevenueToAffiliate: true } } } },
    },
  })
  if (!order) notFound()

  const role = resolveOrderAccessRole(order, session.user)
  if (!role || role === "CUSTOMER") notFound()

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-10">
        <OrderDetailPanel
          order={order}
          role={role}
          backHref={orderDetailBackHref(role)}
          showRevenueToAffiliate={order.supplier.store?.showRevenueToAffiliate ?? false}
        />
      </BentoContainer>
    </BentoShell>
  )
}
