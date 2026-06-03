import { computeSentinelScore } from "@/lib/sentinel/score"
import type {
  SentinelDashboard,
  SentinelDomain,
  SentinelDomainCounts,
  SentinelSeverity,
  SentinelSignalRow,
} from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

const SEVERITIES: SentinelSeverity[] = ["P0", "P1", "P2", "P3"]
const DOMAINS: SentinelDomain[] = [
  "stripe",
  "fulfillment",
  "webhook",
  "catalog",
  "platform",
  "providers",
]

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

function playbookHref(playbook: string | null, entityId: string | null): string | null {
  switch (playbook) {
    case "open-stripe-health":
      return "/admin/stripe-health"
    case "open-auto-fulfill":
      return "/admin/auto-fulfill"
    case "open-order":
      return entityId ? `/admin/orders/${entityId}` : "/admin/orders"
    case "open-providers":
      return "/admin/providers"
    case "run-discovery-bootstrap":
      return null
    default:
      return null
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

export { playbookHref, SEVERITIES, DOMAINS }
