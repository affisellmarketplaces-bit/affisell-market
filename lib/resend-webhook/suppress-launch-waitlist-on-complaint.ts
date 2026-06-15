import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

/** Spam complaint on any expansion buyer email → permanent waitlist suppress (no retry). */
export async function suppressLaunchWaitlistOnComplaint(
  recipientEmail: string
): Promise<{ suppressed: number }> {
  const email = recipientEmail.trim().toLowerCase()
  if (!email) return { suppressed: 0 }

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
    },
  })

  if (rows.length === 0) return { suppressed: 0 }

  const now = new Date()
  let suppressed = 0

  for (const row of rows) {
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
      result: "launch_email_complaint_suppressed",
      email: row.email,
    })
    suppressed += 1
  }

  return { suppressed }
}
