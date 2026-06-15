import { prisma } from "@/lib/prisma"
import { parseExpansionEmailEventMeta } from "@/lib/expansion/expansion-email-event-meta"

export type ExpansionCountryGraduatedEmailStats = {
  deliveredThisMonth: number
  bouncesThisMonth: number
  complaintsThisMonth: number
  sentCount: number
}

export type ExpansionCountryGraduatedEmailStatsMap = Map<
  string,
  ExpansionCountryGraduatedEmailStats
>

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function emptyStats(): ExpansionCountryGraduatedEmailStats {
  return {
    deliveredThisMonth: 0,
    bouncesThisMonth: 0,
    complaintsThisMonth: 0,
    sentCount: 0,
  }
}

function bumpSentCount(stats: ExpansionCountryGraduatedEmailStats): void {
  stats.sentCount = stats.deliveredThisMonth + stats.bouncesThisMonth + stats.complaintsThisMonth
}

export async function loadExpansionGraduatedEmailStatsByCountry(
  now = new Date()
): Promise<ExpansionCountryGraduatedEmailStatsMap> {
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

  const map: ExpansionCountryGraduatedEmailStatsMap = new Map()

  for (const row of deliveredRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-graduated" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.deliveredThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  for (const row of bounceRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-graduated" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.bouncesThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  for (const row of complaintRows) {
    const meta = parseExpansionEmailEventMeta(row.error)
    if (meta.emailKind !== "checkout-graduated" || !meta.countryIso2) continue
    const stats = map.get(meta.countryIso2) ?? emptyStats()
    stats.complaintsThisMonth += 1
    bumpSentCount(stats)
    map.set(meta.countryIso2, stats)
  }

  return map
}
