import { prisma } from "@/lib/prisma"
import {
  isPrismaClientValidationError,
  isPrismaSchemaDriftError,
  productDecoupleFieldsLive,
} from "@/lib/integrations/schema-capabilities"

function emptyCounts(integrationIds: string[]): Record<string, { total: number; decoupled: number }> {
  const out: Record<string, { total: number; decoupled: number }> = {}
  for (const id of integrationIds) {
    out[id] = { total: 0, decoupled: 0 }
  }
  return out
}

/** Fallback when decouple columns missing — count shopify-sync imports only. */
async function legacyIntegrationProductCounts(
  supplierId: string,
  integrationIds: string[]
): Promise<Record<string, { total: number; decoupled: number }>> {
  const out = emptyCounts(integrationIds)
  const shopifyIntegrationId = integrationIds[0]
  if (!shopifyIntegrationId) return out

  const total = await prisma.product.count({
    where: {
      supplierId,
      OR: [
        { importSource: "shopify-sync" },
        { importSource: "woocommerce-sync" },
        { tags: { has: "shopify-sync" } },
        { tags: { has: "woocommerce-sync" } },
        { tags: { has: "live-sync" } },
      ],
    },
  })

  out[shopifyIntegrationId] = { total, decoupled: 0 }
  return out
}

/** Product counts per integration — safe before migrate deploy + prisma generate. */
export async function loadIntegrationProductCounts(
  supplierId: string,
  integrationIds: string[]
): Promise<Record<string, { total: number; decoupled: number }>> {
  if (integrationIds.length === 0) return {}

  if (!productDecoupleFieldsLive()) {
    console.warn("[supplier-integrations]", {
      supplierId,
      result: "product_counts_legacy",
      hint: "npx prisma generate && npx prisma migrate deploy",
    })
    return legacyIntegrationProductCounts(supplierId, integrationIds)
  }

  try {
    const rows = await prisma.product.groupBy({
      by: ["sourceIntegrationId", "isDecoupled"],
      where: {
        supplierId,
        sourceIntegrationId: { in: integrationIds },
      },
      _count: { _all: true },
    })

    const out = emptyCounts(integrationIds)

    for (const row of rows) {
      const id = row.sourceIntegrationId
      if (!id || !out[id]) continue
      out[id].total += row._count._all
      if (row.isDecoupled) out[id].decoupled += row._count._all
    }

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
  } catch (err) {
    if (isPrismaSchemaDriftError(err) || isPrismaClientValidationError(err)) {
      console.warn("[supplier-integrations]", {
        supplierId,
        result: "product_counts_fallback",
        error: err instanceof Error ? err.message : String(err),
      })
      return legacyIntegrationProductCounts(supplierId, integrationIds)
    }
    throw err
  }
}

export type IntegrationSchemaMode = "live" | "legacy"

/** Whether Clone & Own decouple is fully available (client + DB). */
export function integrationDecoupleSchemaMode(): IntegrationSchemaMode {
  return productDecoupleFieldsLive() ? "live" : "legacy"
}
