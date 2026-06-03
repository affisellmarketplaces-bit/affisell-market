import { computeSentinelScore } from "@/lib/sentinel/score"
import { DOMAINS, SEVERITIES } from "@/lib/sentinel/sentinel-shared"
import type {
  SentinelDashboard,
  SentinelDomain,
  SentinelDomainCounts,
  SentinelSeverity,
  SentinelSignalRow,
} from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

function emptyDomainCounts(): SentinelDomainCounts {
  return {
    stripe: { open: 0, p0: 0 },
    fulfillment: { open: 0, p0: 0 },
    webhook: { open: 0, p0: 0 },
    catalog: { open: 0, p0: 0 },
    platform: { open: 0, p0: 0 },
    providers: { open: 0, p0: 0 },
  }
}

export async function loadSentinelDashboard(): Promise<SentinelDashboard> {
  const rows = await prisma.opsSignal.findMany({
    where: { resolvedAt: null },
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: 100,
  })

  const openCounts: Record<SentinelSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  const domainCounts = emptyDomainCounts()

  for (const row of rows) {
    const sev = row.severity as SentinelSeverity
    const dom = row.domain as SentinelDomain
    if (SEVERITIES.includes(sev)) openCounts[sev] += 1
    if (DOMAINS.includes(dom)) {
      domainCounts[dom].open += 1
      if (sev === "P0") domainCounts[dom].p0 += 1
    }
  }

  const lastScan = await prisma.opsSignal.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  })

  const signals: SentinelSignalRow[] = rows.map((r) => ({
    id: r.id,
    severity: r.severity as SentinelSeverity,
    domain: r.domain as SentinelDomain,
    code: r.code,
    title: r.title,
    detail: r.detail,
    metric: r.metric ?? undefined,
    entityType: r.entityType ?? undefined,
    entityId: r.entityId ?? undefined,
    playbook: (r.playbook as SentinelSignalRow["playbook"]) ?? undefined,
    detectedAt: r.detectedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    lastSeenAt: r.lastSeenAt.toISOString(),
  }))

  return {
    score: computeSentinelScore(openCounts),
    scannedAt: lastScan?.lastSeenAt.toISOString() ?? new Date().toISOString(),
    openCounts,
    domainCounts,
    signals,
  }
}

