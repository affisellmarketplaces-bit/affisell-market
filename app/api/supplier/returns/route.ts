import { auth } from "@/auth"
import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"
import {
  assertNoSupplierRetailLeak,
  supplierReturnLiabilityCents,
} from "@/lib/supplier-retail-veil"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ORDER_SETTLEMENT_SELECT = {
  id: true,
  customerEmail: true,
  sellingPriceCents: true,
  basePriceCents: true,
  supplierPriceCents: true,
  supplierPayoutCents: true,
  supplierCommissionRateBps: true,
  usesAffisellAutoBuy: true,
  supplierFeeCents: true,
  aeWholesaleCents: true,
  affiliatePayoutCents: true,
  quantity: true,
  createdAt: true,
  affiliate: { select: { store: { select: { partnerListingCode: true } } } },
  product: { select: { name: true, images: true } },
} as const

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.orderReturn.findMany({
    where: { order: { supplierId: session.user.id } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      order: { select: ORDER_SETTLEMENT_SELECT },
    },
  })

  const payload = rows.map((r) => {
    const buyerRefund =
      r.approvedRefundCents ?? r.requestedRefundCents
    const supplierLiabilityCents = supplierReturnLiabilityCents({
      order: r.order,
      buyerRefundCents: buyerRefund,
      buyerSellCents: r.order.sellingPriceCents,
    })
    return {
      id: r.id,
      status: r.status,
      reasonCode: r.reasonCode,
      reasonDetail: r.reasonDetail,
      evidenceUrls: r.evidenceUrls,
      /** Wholesale clawback at risk — never buyer retail refund €. */
      supplierLiabilityCents,
      hasApprovedRefund: r.approvedRefundCents != null,
      sellerNote: r.sellerNote,
      rejectionReason: r.rejectionReason,
      buyerTrackingCarrier: r.buyerTrackingCarrier,
      buyerTrackingNumber: r.buyerTrackingNumber,
      buyerShippedAt: r.buyerShippedAt?.toISOString() ?? null,
      sellerRespondByAt: r.sellerRespondByAt?.toISOString() ?? null,
      receivedAt: r.receivedAt?.toISOString() ?? null,
      refundedAt: r.refundedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      order: {
        id: r.order.id,
        customerEmail: r.order.customerEmail,
        supplierNetCents: resolveSupplierPayoutCentsFromOrder(r.order),
        partnerListingCode: r.order.affiliate.store?.partnerListingCode ?? null,
        quantity: r.order.quantity,
        orderedAt: r.order.createdAt.toISOString(),
        productName: r.order.product.name,
        productImageUrl: r.order.product.images[0] ?? null,
      },
    }
  })

  assertNoSupplierRetailLeak(payload)
  console.log("[supplier-returns]", { supplierId: session.user.id, count: payload.length })
  return Response.json(payload)
}
