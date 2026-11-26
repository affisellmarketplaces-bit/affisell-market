import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { isNewForecast, parseRecordedEstimate, priceEstimatePayload } from "@/lib/strategic-intelligence/price-estimate-history"
import type { RecordedEstimate } from "@/lib/strategic-intelligence/price-response"

/**
 * The price-sensitivity forecast journal — server part (pure part and the definition of a forecast:
 * price-estimate-history.ts). One AuditLog row per pool, only when the forecast is NEW (other model version or other
 * data), written by the daily run only (`intelligence.price_response_estimate`, id `pr-estimate:<pool>:<day>` +
 * skipDuplicates: two runs on the same day can not write twice). The page view never writes; it only reads. No
 * migration. A missing table / failed read or write = "no history", never a crash.
 */
export const PRICE_ESTIMATE_ACTION = "intelligence.price_response_estimate"
const HISTORY_DAYS = 120
/** At most this many pools are recorded per run (marketplace + taxonomy roots: well below in practice). */
const MAX_POOLS_PER_RUN = 60

export function priceEstimateAuditId(poolKey: string, day: Date): string {
  return `pr-estimate:${poolKey}:${day.toISOString().slice(0, 10)}`
}

export async function recordPriceEstimates(pools: ElasticityPool[], now: Date): Promise<number> {
  if (pools.length === 0) return 0
  try {
    const keys = pools.slice(0, MAX_POOLS_PER_RUN).map((p) => p.key)
    const previous = await prisma.auditLog.findMany({
      where: { action: PRICE_ESTIMATE_ACTION, entityId: { in: keys } },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, payload: true },
      take: keys.length * 5,
    })
    const latest = new Map<string, ReturnType<typeof parseRecordedEstimate>>()
    for (const r of previous) if (r.entityId && !latest.has(r.entityId)) latest.set(r.entityId, parseRecordedEstimate(r.entityId, r.payload))
    const rows = pools
      .slice(0, MAX_POOLS_PER_RUN)
      .map((p) => ({ p, payload: priceEstimatePayload(p, now) }))
      .filter(({ p, payload }) => {
        const last = latest.get(p.key)
        return isNewForecast(payload, last ? { modelVersion: last.modelVersion, dataCutoff: last.dataCutoff.toISOString(), eventsUsed: last.eventsUsed, lastEventAt: last.lastEventAt } : null)
      })
    if (rows.length === 0) return 0
    const res = await prisma.auditLog.createMany({
      data: rows.map(({ p, payload }) => ({
        id: priceEstimateAuditId(p.key, now),
        action: PRICE_ESTIMATE_ACTION,
        entityType: "IntelligencePricePool",
        entityId: p.key,
        payload: payload as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
    return res.count
  } catch {
    return 0
  }
}

export async function loadRecordedPriceEstimates(now: Date): Promise<{ available: boolean; rows: RecordedEstimate[] }> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: PRICE_ESTIMATE_ACTION, createdAt: { gte: new Date(now.getTime() - HISTORY_DAYS * 86_400_000) } },
      select: { entityId: true, payload: true },
      take: 5000,
    })
    return { available: true, rows: rows.map((r) => parseRecordedEstimate(r.entityId ?? "", r.payload)).filter((r): r is NonNullable<typeof r> => r !== null) }
  } catch {
    return { available: false, rows: [] }
  }
}
