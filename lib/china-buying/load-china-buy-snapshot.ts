import { prisma } from "@/lib/prisma"

export type ChinaBuyRouteRow = {
  id: string
  agentId: string
  platform: string | null
  sourceUrl: string
  status: string
  externalRef: string | null
  productName: string | null
  createdAt: string
}

export type ChinaBuySnapshot = {
  routedCount: number
  stubCount: number
  apiOkCount: number
  recentRoutes: ChinaBuyRouteRow[]
  productsWithAgent: number
}

/** Recent China buying routes for Supply Hub (read-only). */
export async function loadChinaBuySnapshot(supplierId: string): Promise<ChinaBuySnapshot> {
  const [recent, statusGroups, productsWithAgent] = await Promise.all([
    prisma.chinaBuyRouteLog.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        agentId: true,
        platform: true,
        sourceUrl: true,
        status: true,
        externalRef: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.chinaBuyRouteLog.groupBy({
      by: ["status"],
      where: { supplierId },
      _count: { _all: true },
    }),
    prisma.product.count({
      where: {
        supplierId,
        chinaBuyingAgentId: { not: null },
      },
    }),
  ])

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all])
  ) as Record<string, number>

  return {
    routedCount: statusGroups.reduce((n, g) => n + g._count._all, 0),
    stubCount: countByStatus.STUB ?? 0,
    apiOkCount: countByStatus.API_OK ?? 0,
    productsWithAgent,
    recentRoutes: recent.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      platform: r.platform,
      sourceUrl: r.sourceUrl,
      status: r.status,
      externalRef: r.externalRef,
      productName: r.product?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
