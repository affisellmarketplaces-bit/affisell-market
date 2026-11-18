import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import type { RecordedEstimate } from "@/lib/strategic-intelligence/price-response"

/**
 * History of the price-sensitivity estimates, to check them against what happens AFTER they were made
 * (price-response.ts → scoreRecordedEstimates). No migration: one AuditLog row per pool and per day, written by the
 * daily run only (`intelligence.price_response_estimate`, deterministic id + skipDuplicates: a second run the same day
 * writes nothing). The page view never writes; it only reads. A missing table / failed read = "no history".
 */
export const PRICE_ESTIMATE_ACTION = "intelligence.price_response_estimate"
const HISTORY_DAYS = 120

export function priceEstimateAuditId(poolKey: string, day: Date): string {
  return `pr-estimate:${poolKey}:${day.toISOString().slice(0, 10)}`
}

export async function recordPriceEstimates(pools: ElasticityPool[], now: Date): Promise<number> {
  if (pools.length === 0) return 0
  try {
    const res = await prisma.auditLog.createMany({
      data: pools.map((p) => ({
        id: priceEstimateAuditId(p.key, now),
        action: PRICE_ESTIMATE_ACTION,
        entityType: "IntelligencePricePool",
        entityId: p.key,
        payload: {
          recordedAt: now.toISOString(),
          mean: p.elasticity,
          se: p.se,
          tau2: p.tau2,
          n: p.n,
          products: p.products,
          grade: p.grade,
        } as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
    return res.count
  } catch {
    return 0
  }
}

/** Parses one stored payload; anything malformed is ignored (never trusted as a number). */
export function parseRecordedEstimate(poolKey: string, payload: unknown): RecordedEstimate | null {
  if (!payload || typeof payload !== "object") return null
  const p = payload as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const mean = num(p.mean), se = num(p.se), tau2 = num(p.tau2)
  const at = typeof p.recordedAt === "string" ? new Date(p.recordedAt) : null
  if (mean === null || se === null || se < 0 || tau2 === null || tau2 < 0 || !at || Number.isNaN(at.getTime())) return null
  return { poolKey, recordedAt: at, mean, se, tau2 }
}

export async function loadRecordedPriceEstimates(now: Date): Promise<{ available: boolean; rows: RecordedEstimate[] }> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: PRICE_ESTIMATE_ACTION, createdAt: { gte: new Date(now.getTime() - HISTORY_DAYS * 86_400_000) } },
      select: { entityId: true, payload: true },
      take: 5000,
    })
    return { available: true, rows: rows.map((r) => parseRecordedEstimate(r.entityId ?? "", r.payload)).filter((r): r is RecordedEstimate => r !== null) }
  } catch {
    return { available: false, rows: [] }
  }
}
