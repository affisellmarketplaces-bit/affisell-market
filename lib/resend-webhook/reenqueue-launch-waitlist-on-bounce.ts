import { logBusiness } from "@/lib/business-log"
import {
  mergeLaunchBounceHandleResult,
  resolveLaunchBounceAction,
  type LaunchBounceHandleResult,
} from "@/lib/expansion/launch-email-bounce-policy"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

/** Hard bounce on launch email: one auto-retry, then permanent suppress. */
export async function reenqueueLaunchWaitlistOnHardBounce(recipientEmail: string): Promise<LaunchBounceHandleResult> {
  const email = recipientEmail.trim().toLowerCase()
  if (!email) return { requeued: 0, suppressed: 0 }

  const rows = await prisma.checkoutLaunchWaitlist.findMany({
    where: {
      marketRegion: MARKET_REGION,
      email: { equals: email, mode: "insensitive" },
      launchNotifiedAt: { not: null },
      launchEmailSuppressedAt: null,
    },
    select: {
      id: true,
      countryIso2: true,
      email: true,
      launchNotifiedAt: true,
      launchEmailBouncedAt: true,
      launchEmailSuppressedAt: true,
    },
  })

  if (rows.length === 0) return { requeued: 0, suppressed: 0 }

  const now = new Date()
  let result: LaunchBounceHandleResult = { requeued: 0, suppressed: 0 }

  for (const row of rows) {
    const action = resolveLaunchBounceAction(row)
    if (action === "ignore") continue

    if (action === "suppress") {
      await prisma.checkoutLaunchWaitlist.update({
        where: { id: row.id },
        data: {
          launchEmailSuppressedAt: now,
          launchFollowUpSentAt: null,
        },
      })
      logBusiness("launch-waitlist", {
        country: row.countryIso2,
        marketRegion: MARKET_REGION,
        result: "launch_email_bounce_suppressed",
        email: row.email,
      })
      result = mergeLaunchBounceHandleResult(result, action)
      continue
    }

    await prisma.checkoutLaunchWaitlist.update({
      where: { id: row.id },
      data: {
        launchEmailBouncedAt: now,
        launchNotifiedAt: null,
        launchFollowUpSentAt: null,
      },
    })
    logBusiness("launch-waitlist", {
      country: row.countryIso2,
      marketRegion: MARKET_REGION,
      result: "launch_email_bounce_requeued",
      email: row.email,
    })
    result = mergeLaunchBounceHandleResult(result, action)
  }

  return result
}
