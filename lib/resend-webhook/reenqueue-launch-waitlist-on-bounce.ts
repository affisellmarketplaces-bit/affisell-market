import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

/** One auto-retry: hard bounce on launch email re-queues waitlist row for expansion-ops notify cron. */
export async function reenqueueLaunchWaitlistOnHardBounce(recipientEmail: string): Promise<number> {
  const email = recipientEmail.trim().toLowerCase()
  if (!email) return 0

  const rows = await prisma.checkoutLaunchWaitlist.findMany({
    where: {
      marketRegion: MARKET_REGION,
      email: { equals: email, mode: "insensitive" },
      launchNotifiedAt: { not: null },
      launchEmailBouncedAt: null,
    },
    select: { id: true, countryIso2: true, email: true },
  })

  if (rows.length === 0) return 0

  const now = new Date()
  await prisma.checkoutLaunchWaitlist.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: {
      launchEmailBouncedAt: now,
      launchNotifiedAt: null,
      launchFollowUpSentAt: null,
    },
  })

  for (const row of rows) {
    logBusiness("launch-waitlist", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_email_bounce_requeued",
      email: row.email,
    })
  }

  return rows.length
}
