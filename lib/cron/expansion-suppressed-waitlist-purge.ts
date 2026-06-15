import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { suppressedWaitlistPurgeCutoff } from "@/lib/expansion/suppressed-waitlist-purge"
import { prisma } from "@/lib/prisma"

export type RunSuppressedWaitlistPurgeCronResult = {
  purged: number
  skipped?: string
}

function purgeDayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Delete waitlist rows suppressed 90+ days ago (daily idempotent cron). */
export async function runSuppressedWaitlistPurgeCron(
  now = new Date()
): Promise<RunSuppressedWaitlistPurgeCronResult> {
  const id = `cron:expansion-purge-suppressed:${purgeDayKey(now)}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return { purged: 0, skipped: "already_ran_today" }
  }

  const cutoff = suppressedWaitlistPurgeCutoff(now)
  const deleted = await prisma.checkoutLaunchWaitlist.deleteMany({
    where: {
      marketRegion: MARKET_REGION,
      launchEmailSuppressedAt: { lt: cutoff },
    },
  })

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  if (deleted.count > 0) {
    logBusiness("expansion-rollout", {
      marketRegion: MARKET_REGION,
      result: "suppressed_waitlist_purged",
      purged: deleted.count,
      cutoff: cutoff.toISOString(),
    })
  }

  return { purged: deleted.count }
}
