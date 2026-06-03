import { computeSentinelScore } from "@/lib/sentinel/score"
import type { SentinelSeverity, SentinelTrendPoint } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function emptyTrend7d(): SentinelTrendPoint[] {
  const points: SentinelTrendPoint[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    points.push({
      day: d.toISOString().slice(0, 10),
      score: 100,
      openP0: 0,
      openTotal: 0,
    })
  }
  return points
}

/** Last scan snapshot per UTC day over the past 7 days. */
export async function loadSentinelTrend7d(): Promise<SentinelTrendPoint[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.opsScanSnapshot.findMany({
    where: { scannedAt: { gte: since } },
    orderBy: { scannedAt: "asc" },
    select: {
      scannedAt: true,
      score: true,
      openP0: true,
      openP1: true,
      openP2: true,
      openP3: true,
    },
  })

  if (rows.length === 0) return emptyTrend7d()

  const byDay = new Map<string, SentinelTrendPoint>()
  for (const row of rows) {
    const day = dayKey(row.scannedAt.toISOString())
    const openTotal = row.openP0 + row.openP1 + row.openP2 + row.openP3
    byDay.set(day, {
      day,
      score: row.score,
      openP0: row.openP0,
      openTotal,
    })
  }

  const trend = emptyTrend7d()
  return trend.map((slot) => byDay.get(slot.day) ?? slot)
}

export type ScanOpenCounts = Record<SentinelSeverity, number>

export async function saveSentinelScanSnapshot(input: {
  scannedAt: Date
  openCounts: ScanOpenCounts
  detected: number
  resolved: number
}): Promise<void> {
  const { openCounts, scannedAt, detected, resolved } = input
  const score = computeSentinelScore(openCounts)

  await prisma.opsScanSnapshot.create({
    data: {
      scannedAt,
      score,
      openP0: openCounts.P0,
      openP1: openCounts.P1,
      openP2: openCounts.P2,
      openP3: openCounts.P3,
      detected,
      resolved,
    },
  })
}
