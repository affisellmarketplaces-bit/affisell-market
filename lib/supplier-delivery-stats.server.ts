import "server-only"

import { prisma } from "@/lib/prisma"
import {
  compareDeclaredToMeasured,
  DELIVERY_STATS_MAX_SAMPLE,
  DELIVERY_STATS_MIN_PROVEN_SAMPLE,
  DELIVERY_STATS_WINDOW_DAYS,
  orderSuppliersForStatsRefresh,
  summarizeDeliveryObservations,
  toProvenDeliveryStats,
  typicalDeclaredTotalDays,
  type ProvenDeliveryStats,
  type SupplierDeliveryStatsValues,
} from "@/lib/supplier-delivery-stats-shared"

const DAY_MS = 24 * 60 * 60 * 1000

/** Carrier-attested physical deliveries only: `digital_instant` / `booking_confirmed` are not parcels. */
const PHYSICAL_DELIVERY_SOURCE = "aftership_webhook"

/** Reads the supplier's recent carrier-attested deliveries and summarises them. */
export async function computeSupplierDeliveryStats(
  supplierId: string,
  now: Date = new Date()
): Promise<SupplierDeliveryStatsValues> {
  const since = new Date(now.getTime() - DELIVERY_STATS_WINDOW_DAYS * DAY_MS)
  const rows = await prisma.order.findMany({
    where: {
      supplierId,
      deliveredAtSource: PHYSICAL_DELIVERY_SOURCE,
      deliveredAt: { gte: since },
      paidAt: { not: null },
    },
    orderBy: { deliveredAt: "desc" },
    take: DELIVERY_STATS_MAX_SAMPLE,
    select: { paidAt: true, shippedAt: true, deliveredAt: true },
  })

  return summarizeDeliveryObservations(
    rows.flatMap((r) =>
      r.paidAt && r.deliveredAt ? [{ paidAt: r.paidAt, shippedAt: r.shippedAt, deliveredAt: r.deliveredAt }] : []
    )
  )
}

export async function refreshSupplierDeliveryStats(
  supplierId: string,
  now: Date = new Date()
): Promise<SupplierDeliveryStatsValues> {
  const stats = await computeSupplierDeliveryStats(supplierId, now)
  const data = {
    sampleSize: stats.sampleSize,
    medianDispatchDays: stats.medianDispatchDays,
    medianEndToEndDays: stats.medianEndToEndDays,
    p90EndToEndDays: stats.p90EndToEndDays,
    windowDays: DELIVERY_STATS_WINDOW_DAYS,
    computedAt: now,
  }
  await prisma.supplierDeliveryStats.upsert({
    where: { supplierId },
    create: { supplierId, ...data },
    update: data,
  })
  return stats
}

export type RefreshDeliveryStatsBatchResult = {
  suppliers: number
  refreshed: number
  errors: number
  /** True when the time budget ran out before every supplier was refreshed (the rest go first next run). */
  truncated: boolean
}

/**
 * Time-boxed refresh (cron functions are capped at 10 s): suppliers never measured first, then the stalest.
 */
export async function refreshSupplierDeliveryStatsBatch(
  options: { budgetMs?: number; now?: () => number } = {}
): Promise<RefreshDeliveryStatsBatchResult> {
  const budgetMs = options.budgetMs ?? 6500
  const clock = options.now ?? Date.now
  const startedAt = clock()

  const [suppliers, existing] = await Promise.all([
    prisma.user.findMany({ where: { role: "SUPPLIER" }, select: { id: true }, orderBy: { id: "asc" } }),
    prisma.supplierDeliveryStats.findMany({ select: { supplierId: true, computedAt: true } }),
  ])
  const queue = orderSuppliersForStatsRefresh(
    suppliers.map((s) => s.id),
    new Map(existing.map((e) => [e.supplierId, e.computedAt]))
  )

  let refreshed = 0
  let errors = 0
  for (const supplierId of queue) {
    if (clock() - startedAt >= budgetMs) {
      return { suppliers: queue.length, refreshed, errors, truncated: true }
    }
    try {
      await refreshSupplierDeliveryStats(supplierId)
      refreshed += 1
    } catch (error) {
      errors += 1
      console.error("[supplier-delivery-stats]", {
        supplierId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { suppliers: queue.length, refreshed, errors, truncated: false }
}

/**
 * Stats safe to show buyers (enough measured deliveries), or `null`. Never throws: the PDP must render without it.
 */
export async function loadProvenSupplierDeliveryStats(
  supplierId: string | null | undefined
): Promise<ProvenDeliveryStats | null> {
  if (!supplierId) return null
  try {
    const row = await prisma.supplierDeliveryStats.findUnique({
      where: { supplierId },
      select: { sampleSize: true, medianDispatchDays: true, medianEndToEndDays: true, p90EndToEndDays: true },
    })
    return toProvenDeliveryStats(row)
  } catch (error) {
    console.error("[supplier-delivery-stats]", error instanceof Error ? error.message : String(error))
    return null
  }
}

/** Same as above for many suppliers in one query (catalogue cards). Suppliers without proven stats are absent. */
export async function loadProvenSupplierDeliveryStatsMany(
  supplierIds: readonly string[]
): Promise<Map<string, ProvenDeliveryStats>> {
  const out = new Map<string, ProvenDeliveryStats>()
  const ids = [...new Set(supplierIds.filter(Boolean))]
  if (ids.length === 0) return out
  try {
    const rows = await prisma.supplierDeliveryStats.findMany({
      where: { supplierId: { in: ids } },
      select: {
        supplierId: true,
        sampleSize: true,
        medianDispatchDays: true,
        medianEndToEndDays: true,
        p90EndToEndDays: true,
      },
    })
    for (const row of rows) {
      const proven = toProvenDeliveryStats(row)
      if (proven) out.set(row.supplierId, proven)
    }
  } catch (error) {
    console.error("[supplier-delivery-stats]", error instanceof Error ? error.message : String(error))
  }
  return out
}

export type SupplierDeliveryInsight = {
  /** Measured stats, once enough carrier-tracked deliveries exist. */
  proven: ProvenDeliveryStats | null
  /** Carrier-tracked deliveries measured so far (also when below the threshold, for the progress line). */
  measuredOrders: number
  minForProven: number
  windowDays: number
  /** The promise the supplier's live listings make (median) — null when nothing is declared. */
  declared: { processingDays: number; deliveryMaxDays: number; totalDays: number } | null
  comparison: ReturnType<typeof compareDeclaredToMeasured>
}

/** The supplier's own view: measured vs promised delivery. Throws only on a database failure (callers catch). */
export async function loadSupplierDeliveryInsight(supplierId: string): Promise<SupplierDeliveryInsight> {
  const [row, products] = await Promise.all([
    prisma.supplierDeliveryStats.findUnique({
      where: { supplierId },
      select: { sampleSize: true, medianDispatchDays: true, medianEndToEndDays: true, p90EndToEndDays: true },
    }),
    prisma.product.findMany({
      where: { supplierId, isDraft: false },
      select: { processingTime: true, deliveryMax: true },
      take: 500,
    }),
  ])
  const proven = toProvenDeliveryStats(row)
  const declared = typicalDeclaredTotalDays(products)
  return {
    proven,
    measuredOrders: row?.sampleSize ?? 0,
    minForProven: DELIVERY_STATS_MIN_PROVEN_SAMPLE,
    windowDays: DELIVERY_STATS_WINDOW_DAYS,
    declared,
    comparison: declared ? compareDeclaredToMeasured(declared, proven) : null,
  }
}
