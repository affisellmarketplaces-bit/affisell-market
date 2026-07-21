import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getSupplierBadge } from "@/lib/logistics/supplier-score"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/suppliers/ranking — suppliers sorted by delivery trustScore.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100)

  const rows = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: {
      id: true,
      name: true,
      email: true,
      trustScore: true,
      isTopSupplier: true,
    },
    orderBy: [{ isTopSupplier: "desc" }, { trustScore: "desc" }],
    take: limit,
  })

  const metricsList = await prisma.supplierMetrics.findMany({
    where: { supplierId: { in: rows.map((r) => r.id) } },
  })
  const metricsById = new Map(metricsList.map((m) => [m.supplierId, m]))

  const suppliers = rows.map((r) => {
    const m = metricsById.get(r.id)
    const trustScore = m?.trustScore ?? r.trustScore
    const badge = getSupplierBadge(trustScore)
    return {
      id: r.id,
      name: r.name,
      email: role === "ADMIN" ? r.email : undefined,
      trustScore,
      deliveryScore: m?.deliveryScore ?? 75,
      isTopSupplier: r.isTopSupplier || trustScore >= 90,
      onTimeRate:
        m && m.totalOrders > 0 ? m.onTimeDeliveries / m.totalOrders : null,
      totalOrders: m?.totalOrders ?? 0,
      promisedVsActualDelta: m?.promisedVsActualDelta ?? 0,
      badge,
      boost: badge.boost,
    }
  })

  suppliers.sort((a, b) => {
    if (b.boost !== a.boost) return b.boost - a.boost
    return b.trustScore - a.trustScore
  })

  console.log("[api/suppliers/ranking]", {
    userId: session.user.id,
    count: suppliers.length,
  })

  return NextResponse.json({ suppliers, count: suppliers.length })
}
