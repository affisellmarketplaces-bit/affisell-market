import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { logBusiness } from "@/lib/business-log"
import { sendCheckoutCountryLaunchFollowupEmail } from "@/lib/emails/send-checkout-country-launch-followup"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

const FOLLOWUP_AFTER_MS = 2 * 24 * 60 * 60 * 1000
const BATCH_LIMIT = 80

export type RunCheckoutLaunchFollowupCronResult = {
  processed: number
  sent: number
  skipped: number
  failed: number
}

/** J+2 nudge for waitlist buyers who were notified but have not ordered yet. */
export async function runCheckoutLaunchFollowupCron(
  now = new Date()
): Promise<RunCheckoutLaunchFollowupCronResult> {
  const cutoff = new Date(now.getTime() - FOLLOWUP_AFTER_MS)

  const waiters = await prisma.checkoutLaunchWaitlist.findMany({
    where: {
      marketRegion: MARKET_REGION,
      launchNotifiedAt: { lte: cutoff },
      launchFollowUpSentAt: null,
    },
    orderBy: { launchNotifiedAt: "asc" },
    take: BATCH_LIMIT,
    select: {
      id: true,
      email: true,
      countryIso2: true,
      locale: true,
      launchNotifiedAt: true,
    },
  })

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const waiter of waiters) {
    const recentOrders = await prisma.order.findMany({
      where: {
        customerEmail: waiter.email,
        status: { in: ["paid", "shipped", "delivered", "completed", "preparing"] },
      },
      select: { id: true, shippingAddress: true },
      take: 30,
      orderBy: { createdAt: "desc" },
    })
    const hasOrder = recentOrders.some(
      (order) => extractOrderShippingCountryIso2(order.shippingAddress) === waiter.countryIso2
    )

    if (hasOrder) {
      await prisma.checkoutLaunchWaitlist.update({
        where: { id: waiter.id },
        data: { launchFollowUpSentAt: now },
      })
      skipped += 1
      continue
    }

    const locale = waiter.locale === "en" ? "en" : "fr"
    const countryName = expansionCountryLabel(waiter.countryIso2, locale)
    const result = await sendCheckoutCountryLaunchFollowupEmail({
      email: waiter.email,
      countryIso2: waiter.countryIso2,
      countryName,
      locale: waiter.locale,
    })

    if (!result.ok) {
      failed += 1
      console.error("[launch-waitlist]", {
        country: waiter.countryIso2,
        email: waiter.email,
        result: "followup_failed",
        error: result.error,
      })
      continue
    }

    await prisma.checkoutLaunchWaitlist.update({
      where: { id: waiter.id },
      data: { launchFollowUpSentAt: now },
    })
    sent += 1
    logBusiness("launch-waitlist", {
      country: waiter.countryIso2,
      marketRegion: MARKET_REGION,
      result: "followup_sent",
      email: waiter.email,
    })
  }

  return { processed: waiters.length, sent, skipped, failed }
}
