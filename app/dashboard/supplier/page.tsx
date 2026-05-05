import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

import { SupplierDashboard, type SupplierDashboardStats } from "./supplier-dashboard"

export default async function SupplierDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier")
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  const userId = session.user.id
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let store = await prisma.store.findUnique({ where: { userId }, select: { slug: true } })
  if (!store) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (u) {
      const created = await ensureMerchantStore({
        userId,
        email: u.email,
        displayName: u.name,
      })
      store = { slug: created.slug }
    }
  }

  const [
    activeProducts,
    draftProducts,
    affiliateIds,
    affiliatesThisWeekRows,
    monthOrderAgg,
    monthOrderCount,
    clicksSum,
  ] = await Promise.all([
    prisma.product.count({ where: { supplierId: userId, active: true } }),
    prisma.product.count({ where: { supplierId: userId, active: false } }),
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: { product: { supplierId: userId } },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: {
        createdAt: { gte: sevenDaysAgo },
        product: { supplierId: userId },
      },
    }),
    prisma.order.aggregate({
      where: { supplierId: userId, createdAt: { gte: startOfMonth } },
      _sum: { marginCents: true },
    }),
    prisma.order.count({
      where: { supplierId: userId, createdAt: { gte: startOfMonth } },
    }),
    prisma.affiliateProduct.aggregate({
      where: { product: { supplierId: userId } },
      _sum: { clicks: true },
    }),
  ])

  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ordersPrevMonthCount = await prisma.order.count({
    where: {
      supplierId: userId,
      createdAt: {
        gte: startPrevMonth,
        lt: startOfMonth,
      },
    },
  })

  const monthRevenueCents = monthOrderAgg._sum.marginCents ?? 0
  const storefrontClicks = clicksSum._sum.clicks ?? 0

  const ordersDeltaPct =
    ordersPrevMonthCount > 0
      ? Math.round(((monthOrderCount - ordersPrevMonthCount) / ordersPrevMonthCount) * 100)
      : monthOrderCount > 0
        ? 100
        : null

  const stats: SupplierDashboardStats = {
    activeProducts,
    draftProducts,
    affiliateCount: affiliateIds.length,
    affiliatesThisWeek: affiliatesThisWeekRows.length,
    monthRevenueCents,
    monthOrderCount,
    orderMonthDeltaPct: ordersDeltaPct,
    storefrontClicks,
  }

  return (
    <SupplierDashboard
      storeSlug={store?.slug ?? null}
      stats={stats}
    />
  )
}
