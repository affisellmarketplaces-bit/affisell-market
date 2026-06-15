import { MARKET_REGION } from "@/lib/market-config"
import { suppressedWaitlistPurgeCutoff } from "@/lib/expansion/suppressed-waitlist-purge"
import { prisma } from "@/lib/prisma"

export type ExpansionEmailBounceStats = {
  bouncesThisMonth: number
  complaintsThisMonth: number
  launchRetriesPending: number
  launchSuppressedTotal: number
  suppressedStalePendingPurge: number
}

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export async function loadExpansionEmailBounceStats(now = new Date()): Promise<ExpansionEmailBounceStats> {
  const monthStart = monthStartUtc(now)

  const [bouncesThisMonth, complaintsThisMonth, launchRetriesPending, launchSuppressedTotal, suppressedStalePendingPurge] =
    await Promise.all([
    prisma.processedWebhook.count({
      where: { status: "expansion_bounce", createdAt: { gte: monthStart } },
    }),
    prisma.processedWebhook.count({
      where: { status: "expansion_complaint", createdAt: { gte: monthStart } },
    }),
    prisma.checkoutLaunchWaitlist.count({
      where: {
        marketRegion: MARKET_REGION,
        launchEmailBouncedAt: { not: null },
        launchNotifiedAt: null,
        launchEmailSuppressedAt: null,
      },
    }),
    prisma.checkoutLaunchWaitlist.count({
      where: {
        marketRegion: MARKET_REGION,
        launchEmailSuppressedAt: { not: null },
      },
    }),
    prisma.checkoutLaunchWaitlist.count({
      where: {
        marketRegion: MARKET_REGION,
        launchEmailSuppressedAt: { lt: suppressedWaitlistPurgeCutoff(now) },
      },
    }),
  ])

  return {
    bouncesThisMonth,
    complaintsThisMonth,
    launchRetriesPending,
    launchSuppressedTotal,
    suppressedStalePendingPurge,
  }
}
