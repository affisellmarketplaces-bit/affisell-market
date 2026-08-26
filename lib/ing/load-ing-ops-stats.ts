import { type PrismaClient } from "@prisma/client"

import { checkEscalation } from "@/lib/ing/escalation"
import {
  formatIngOpsRelativeTime,
  isIngDashboardEnabled,
  nextIngCronRunUtc,
} from "@/lib/ing/ing-ops-config"
import {
  loadManualSupplierNudgeCandidates,
  MANUAL_NUDGE_LOOKBACK_MS,
  MANUAL_REQUIRED_GROUP_WHERE,
} from "@/lib/ing/manual-supplier-nudge"

export type IngOpsSupplierRow = {
  supplierId: string
  email: string
  name: string
  manualGroups: number
  lastNudgeAt: string | null
  nudgesCount: number
  daysWithoutResponse: number | null
  escalated: boolean
}

export type IngOpsTimelineEntry = {
  id: string
  supplierId: string
  email: string
  resendId: string | null
  groupsCount: number
  sentAt: string
  status: "sent" | "delivered" | "bounced" | "unknown"
}

export type IngOpsStats = {
  enabled: boolean
  status: "operational" | "degraded" | "disabled"
  lastRunAt: string | null
  lastRunRelative: string
  nextRunAt: string
  nextRunRelative: string
  kpis: {
    manualGroups7d: number
    nudgedToday: number
    skipped48h: number
    nonResponders30d: number
  }
  suppliers: IngOpsSupplierRow[]
  timeline: IngOpsTimelineEntry[]
  escalationCandidates: Awaited<ReturnType<typeof checkEscalation>>
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function loadIngOpsStats(prisma: PrismaClient): Promise<IngOpsStats> {
  const enabled = isIngDashboardEnabled()
  const nextRun = nextIngCronRunUtc()
  const lookbackCutoff = new Date(Date.now() - MANUAL_NUDGE_LOOKBACK_MS)
  const todayStart = startOfUtcDay()

  if (!enabled) {
    return {
      enabled: false,
      status: "disabled",
      lastRunAt: null,
      lastRunRelative: "—",
      nextRunAt: nextRun.toISOString(),
      nextRunRelative: formatIngOpsRelativeTime(nextRun.toISOString()),
      kpis: {
        manualGroups7d: 0,
        nudgedToday: 0,
        skipped48h: 0,
        nonResponders30d: 0,
      },
      suppliers: [],
      timeline: [],
      escalationCandidates: [],
    }
  }

  const [manualGroups7d, nudgedToday, recentLogs, allEligible, cooledEligible, escalationCandidates] =
    await Promise.all([
      prisma.fulfillmentGroup.count({
        where: {
          ...MANUAL_REQUIRED_GROUP_WHERE,
          createdAt: { gte: lookbackCutoff },
        },
      }),
      prisma.ingNudgeLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.ingNudgeLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      loadManualSupplierNudgeCandidates(prisma, { enforceCooldown: false }),
      loadManualSupplierNudgeCandidates(prisma, { enforceCooldown: true }),
      checkEscalation(prisma),
    ])

  const skipped48h = Math.max(
    0,
    allEligible.candidates.length - cooledEligible.candidates.length
  )

  const lastRunAt = recentLogs[0]?.createdAt.toISOString() ?? null
  const supplierIds = [...new Set(recentLogs.map((l) => l.supplierId))]

  const [users, nudgeCounts, manualBySupplier] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, email: true, name: true },
    }),
    prisma.ingNudgeLog.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: supplierIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.fulfillmentGroup.groupBy({
      by: ["supplierId"],
      where: {
        ...MANUAL_REQUIRED_GROUP_WHERE,
        supplierId: { in: supplierIds },
        createdAt: { gte: lookbackCutoff },
      },
      _count: { _all: true },
    }),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const nudgeAgg = new Map(
    nudgeCounts.map((n) => [
      n.supplierId,
      { count: n._count._all, last: n._max.createdAt?.toISOString() ?? null },
    ])
  )
  const manualMap = new Map(manualBySupplier.map((m) => [m.supplierId, m._count._all]))
  const escalatedIds = new Set(escalationCandidates.map((e) => e.supplierId))

  const supplierRows: IngOpsSupplierRow[] = cooledEligible.candidates.map((c) => {
    const agg = nudgeAgg.get(c.supplierId)
    const lastNudgeAt = agg?.last ?? null
    const daysWithoutResponse = lastNudgeAt
      ? Math.floor((Date.now() - new Date(lastNudgeAt).getTime()) / (24 * 60 * 60 * 1000))
      : null
    return {
      supplierId: c.supplierId,
      email: c.email,
      name: c.name,
      manualGroups: c.manualGroups,
      lastNudgeAt,
      nudgesCount: agg?.count ?? 0,
      daysWithoutResponse,
      escalated: escalatedIds.has(c.supplierId),
    }
  })

  for (const row of escalationCandidates) {
    if (supplierRows.some((s) => s.supplierId === row.supplierId)) continue
    supplierRows.push({
      supplierId: row.supplierId,
      email: row.email,
      name: row.name,
      manualGroups: row.manualGroups,
      lastNudgeAt: row.lastNudgeAt,
      nudgesCount: row.nudges,
      daysWithoutResponse: row.daysSinceLastOrder,
      escalated: true,
    })
  }

  supplierRows.sort((a, b) => b.manualGroups - a.manualGroups)

  const timeline: IngOpsTimelineEntry[] = recentLogs.slice(0, 20).map((log) => {
    const user = userById.get(log.supplierId)
    return {
      id: log.id,
      supplierId: log.supplierId,
      email: user?.email ?? log.supplierId,
      resendId: log.resendId,
      groupsCount: log.groupsCount,
      sentAt: log.createdAt.toISOString(),
      status: log.resendId ? "sent" : "unknown",
    }
  })

  return {
    enabled: true,
    status: escalationCandidates.length > 0 ? "degraded" : "operational",
    lastRunAt,
    lastRunRelative: formatIngOpsRelativeTime(lastRunAt),
    nextRunAt: nextRun.toISOString(),
    nextRunRelative: formatIngOpsRelativeTime(nextRun.toISOString()),
    kpis: {
      manualGroups7d,
      nudgedToday,
      skipped48h,
      nonResponders30d: escalationCandidates.length,
    },
    suppliers: supplierRows,
    timeline,
    escalationCandidates,
  }
}
