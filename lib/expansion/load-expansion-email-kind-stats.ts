import { prisma } from "@/lib/prisma"

export type ExpansionEmailKindStat = {
  emailKind: string
  deliveredThisMonth: number
  bouncesThisMonth: number
  complaintsThisMonth: number
}

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function parseKindMeta(error: string | null | undefined): string | null {
  if (!error) return null
  const parts = error.split(":")
  const kind = parts.length >= 2 ? parts[1]?.trim() : parts[0]?.trim()
  return kind && kind.length > 0 ? kind : null
}

export async function loadExpansionEmailKindStats(now = new Date()): Promise<ExpansionEmailKindStat[]> {
  const monthStart = monthStartUtc(now)
  const [deliveredRows, bounceRows, complaintRows] = await Promise.all([
    prisma.processedWebhook.findMany({
      where: { status: "expansion_delivered", createdAt: { gte: monthStart } },
      select: { error: true },
    }),
    prisma.processedWebhook.findMany({
      where: {
        id: { startsWith: "expansion:bounce:" },
        createdAt: { gte: monthStart },
      },
      select: { error: true },
    }),
    prisma.processedWebhook.findMany({
      where: {
        id: { startsWith: "expansion:complaint:" },
        createdAt: { gte: monthStart },
      },
      select: { error: true },
    }),
  ])

  const byKind = new Map<string, { delivered: number; bounces: number; complaints: number }>()

  for (const row of deliveredRows) {
    const kind = parseKindMeta(row.error) ?? "unknown"
    const existing = byKind.get(kind) ?? { delivered: 0, bounces: 0, complaints: 0 }
    byKind.set(kind, { ...existing, delivered: existing.delivered + 1 })
  }

  for (const row of bounceRows) {
    const kind = parseKindMeta(row.error) ?? "unknown"
    const existing = byKind.get(kind) ?? { delivered: 0, bounces: 0, complaints: 0 }
    byKind.set(kind, { ...existing, bounces: existing.bounces + 1 })
  }

  for (const row of complaintRows) {
    const kind = parseKindMeta(row.error) ?? "unknown"
    const existing = byKind.get(kind) ?? { delivered: 0, bounces: 0, complaints: 0 }
    byKind.set(kind, { ...existing, complaints: existing.complaints + 1 })
  }

  return [...byKind.entries()]
    .map(([emailKind, counts]) => ({
      emailKind,
      deliveredThisMonth: counts.delivered,
      bouncesThisMonth: counts.bounces,
      complaintsThisMonth: counts.complaints,
    }))
    .sort((a, b) => b.deliveredThisMonth - a.deliveredThisMonth)
}
