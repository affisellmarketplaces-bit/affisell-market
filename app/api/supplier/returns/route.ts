import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
      order: {
        select: {
          id: true,
          customerEmail: true,
          basePriceCents: true,
          quantity: true,
          createdAt: true,
          affiliate: { select: { store: { select: { partnerListingCode: true } } } },
          product: { select: { name: true, images: true } },
        },
      },
    },
  })

  return Response.json(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      reasonCode: r.reasonCode,
      reasonDetail: r.reasonDetail,
      evidenceUrls: r.evidenceUrls,
      requestedRefundCents: r.requestedRefundCents,
      approvedRefundCents: r.approvedRefundCents,
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
        supplierNetCents: r.order.basePriceCents,
        partnerListingCode: r.order.affiliate.store?.partnerListingCode ?? null,
        quantity: r.order.quantity,
        orderedAt: r.order.createdAt.toISOString(),
        productName: r.order.product.name,
        productImageUrl: r.order.product.images[0] ?? null,
      },
    }))
  )
}
