import { prisma } from "@/lib/prisma"

/** Product counts per integration for supplier dashboard. */
export async function loadIntegrationProductCounts(
  supplierId: string,
  integrationIds: string[]
): Promise<Record<string, { total: number; decoupled: number }>> {
  if (integrationIds.length === 0) return {}

  const rows = await prisma.product.groupBy({
    by: ["sourceIntegrationId", "isDecoupled"],
    where: {
      supplierId,
      sourceIntegrationId: { in: integrationIds },
    },
    _count: { _all: true },
  })

  const out: Record<string, { total: number; decoupled: number }> = {}
  for (const id of integrationIds) {
    out[id] = { total: 0, decoupled: 0 }
  }

  for (const row of rows) {
    const id = row.sourceIntegrationId
    if (!id || !out[id]) continue
    out[id].total += row._count._all
    if (row.isDecoupled) out[id].decoupled += row._count._all
  }

  // Legacy rows synced before sourceIntegrationId (shopify-sync tag)
  const legacyCount = await prisma.product.count({
    where: {
      supplierId,
      importSource: "shopify-sync",
      sourceIntegrationId: null,
    },
  })

  if (legacyCount > 0 && integrationIds[0]) {
    out[integrationIds[0]].total += legacyCount
  }

  return out
}
