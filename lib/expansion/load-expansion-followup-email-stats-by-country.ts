import { prisma } from "@/lib/prisma"
import { parseExpansionEmailEventMeta } from "@/lib/expansion/expansion-email-event-meta"

export type ExpansionCountryFollowupEmailStats = {
  deliveredThisMonth: number
  bouncesThisMonth: number
  complaintsThisMonth: number
  sentCount: number
}

export type ExpansionCountryFollowupEmailStatsMap = Map<
  string,
  ExpansionCountryFollowupEmailStats
>

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function emptyStats(): ExpansionCountryFollowupEmailStats {
  return {
    deliveredThisMonth: 0,
    bouncesThisMonth: 0,
    complaintsThisMonth: 0,
    sentCount: 0,
  }
}

function bumpSentCount(stats: ExpansionCountryFollowupEmailStats): void {
  stats.sentCount = stats.deliveredThisMonth + stats.bouncesThisMonth + stats.complaintsThisMonth
}

export async function loadExpansionFollowupEmailStatsByCountry(
  now = new Date()
): Promise<ExpansionCountryFollowupEmailStatsMap> {
  const monthStart = monthStartUtc(now)
  const [deliveredRows, bounceRows, complaintRows] = await Promise.all([
    prisma.processedWebhook.findMany({
      where: { status: "expansion_delivered", createdAt: { gte: monthStart } },
      select: { error: true },
    }),
    prisma.processedWebhook.findMany({
      where: { id: { startsWith: "expansion:bounce:" }, createdAt: { gte: monthStart } },
      select: { error: true },
    }),
    prisma.processedWebhook.findMany({
      where: { id: { startsWith: "expansion:complaint:" }, createdAt: { gte: monthStart } },
      select: { error: true },
    }),
  ])

  const map: ExpansionCountryFollowupEmailStatsMap = new Map()

  for (const row of deliveredRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-launch-followup" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.deliveredThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  for (const row of bounceRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-launch-followup" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.bouncesThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  for (const row of complaintRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-launch-followup" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.complaintsThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  return map
}
