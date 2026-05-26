import { prisma } from "@/lib/prisma"

export async function exportUserDataForGdpr(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
      privacyAcceptedAt: true,
      privacyAcceptedVersion: true,
      cookieConsent: true,
      store: {
        select: {
          name: true,
          slug: true,
          partnerListingCode: true,
          showRevenueToAffiliate: true,
        },
      },
    },
  })
  if (!user) return null

  const [buyerOrders, supplierOrders, affiliateOrders, notifications] = await Promise.all([
    prisma.order.findMany({
      where: { buyerUserId: userId },
      take: 500,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalCents: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.order.findMany({
      where: { supplierId: userId },
      take: 500,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        supplierPayoutCents: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.order.findMany({
      where: { affiliateId: userId },
      take: 500,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      take: 200,
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, message: true, createdAt: true },
    }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    user,
    orders: {
      asBuyer: buyerOrders,
      asSupplier: supplierOrders,
      asAffiliate: affiliateOrders,
    },
    notifications,
  }
}
