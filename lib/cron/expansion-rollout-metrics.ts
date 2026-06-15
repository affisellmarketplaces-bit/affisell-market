import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunExpansionRolloutMetricsResult = {
  checked: number
  firstOrdersRecorded: number
}

const PAID_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"] as const

/** Attach first paid order to enabled rollouts + log for Metabase. */
export async function runExpansionRolloutMetricsCron(): Promise<RunExpansionRolloutMetricsResult> {
  const rollouts = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion: MARKET_REGION,
      enabled: true,
      firstOrderAt: null,
    },
    select: { id: true, countryIso2: true, openedAt: true },
  })

  let firstOrdersRecorded = 0

  for (const rollout of rollouts) {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: [...PAID_STATUSES] },
        createdAt: { gte: rollout.openedAt },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, shippingAddress: true, customerEmail: true, createdAt: true },
    })

    const match = orders.find(
      (order) => extractOrderShippingCountryIso2(order.shippingAddress) === rollout.countryIso2
    )
    if (!match) continue

    await prisma.checkoutCountryRollout.update({
      where: { id: rollout.id },
      data: { firstOrderAt: match.createdAt, firstOrderId: match.id },
    })

    firstOrdersRecorded += 1
    logBusiness("expansion-rollout", {
      country: rollout.countryIso2,
      marketRegion: MARKET_REGION,
      result: "first_order",
      orderId: match.id,
      countryLabel: expansionCountryLabel(rollout.countryIso2, "en"),
    })
  }

  return { checked: rollouts.length, firstOrdersRecorded }
}
