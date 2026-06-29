import Link from "next/link"
import { requireMerchantSession } from "@/lib/dashboard-session"
import { notFound } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { OrderDetailPanel } from "@/components/legal/order-detail-panel"
import { buildOrderCommissionView } from "@/lib/order-commission-breakdown"
import { orderDetailBackHref, resolveOrderAccessRole } from "@/lib/order-access"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function DashboardOrderDetailPage({ params }: Props) {
  const session = await requireMerchantSession("/dashboard/orders/[id]")


  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      supplier: {
        select: {
          id: true,
          supplierFeeBps: true,
          supplierFeeBpsCatalog: true,
          supplierFeeBpsAutoBuy: true,
          store: { select: { showRevenueToAffiliate: true } },
        },
      },
    },
  })
  if (!order) notFound()

  const role = resolveOrderAccessRole(order, session.user)
  if (!role || role === "CUSTOMER") notFound()

  const showRevenueToAffiliate = order.supplier.store?.showRevenueToAffiliate ?? false
  const commissionView = buildOrderCommissionView(
    role,
    {
      basePriceCents: order.basePriceCents,
      supplierPriceCents: order.supplierPriceCents,
      sellingPriceCents: order.sellingPriceCents,
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      affiliatePayoutCents: order.affiliatePayoutCents,
      affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
      affiliateFeeCents: order.affiliateFeeCents,
      supplierFeeCents: order.supplierFeeCents,
      usesAffisellAutoBuy: order.usesAffisellAutoBuy,
      aeWholesaleCents: order.aeWholesaleCents,
      supplierCommissionRateBps: order.supplierCommissionRateBps,
      affisellFeeCents: order.affisellFeeCents,
      supplierPayoutCents: order.supplierPayoutCents,
      marginCents: order.marginCents,
      supplier: {
        supplierFeeBps: order.supplier.supplierFeeBps,
        supplierFeeBpsCatalog: order.supplier.supplierFeeBpsCatalog,
        supplierFeeBpsAutoBuy: order.supplier.supplierFeeBpsAutoBuy,
      },
    },
    showRevenueToAffiliate
  )

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-10">
        <OrderDetailPanel
          order={{
            id: order.id,
            status: order.status,
            createdAt: order.createdAt,
            productName: order.product.name,
          }}
          role={role}
          commissionView={commissionView}
          backHref={orderDetailBackHref(role)}
        />
      </BentoContainer>
    </BentoShell>
  )
}
