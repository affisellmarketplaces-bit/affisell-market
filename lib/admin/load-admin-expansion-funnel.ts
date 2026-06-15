import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

const PAID_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"] as const

export type ExpansionFunnelSummary = {
  waitlistTotal: number
  notifiedTotal: number
  followUpTotal: number
  rolloutsEnabled: number
  rolloutsWithFirstOrder: number
  notifyRatePct: number
  firstOrderRatePct: number
}

export type ExpansionCountryFunnel = {
  countryIso2: string
  notifiedCount: number
  followUpCount: number
  paidOrdersSinceOpen: number
  notifyRatePct: number
  orderRatePct: number
}

async function countPaidOrdersForCountrySince(
  countryIso2: string,
  since: Date
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...PAID_STATUSES] },
      createdAt: { gte: since },
    },
    select: { shippingAddress: true },
    orderBy: { createdAt: "desc" },
    take: 1500,
  })
  return orders.filter(
    (order) => extractOrderShippingCountryIso2(order.shippingAddress) === countryIso2
  ).length
}

export async function loadExpansionFunnelSummary(): Promise<ExpansionFunnelSummary> {
  const marketRegion = MARKET_REGION

  const [waitlistTotal, notifiedTotal, followUpTotal, rollouts] = await Promise.all([
    prisma.checkoutLaunchWaitlist.count({ where: { marketRegion } }),
    prisma.checkoutLaunchWaitlist.count({
      where: { marketRegion, launchNotifiedAt: { not: null } },
    }),
    prisma.checkoutLaunchWaitlist.count({
      where: { marketRegion, launchFollowUpSentAt: { not: null } },
    }),
    prisma.checkoutCountryRollout.findMany({
      where: { marketRegion, enabled: true },
      select: { firstOrderAt: true },
    }),
  ])

  const rolloutsEnabled = rollouts.length
  const rolloutsWithFirstOrder = rollouts.filter((row) => row.firstOrderAt).length
  const notifyRatePct =
    waitlistTotal > 0 ? Math.round((notifiedTotal / waitlistTotal) * 1000) / 10 : 0
  const firstOrderRatePct =
    rolloutsEnabled > 0
      ? Math.round((rolloutsWithFirstOrder / rolloutsEnabled) * 1000) / 10
      : 0

  return {
    waitlistTotal,
    notifiedTotal,
    followUpTotal,
    rolloutsEnabled,
    rolloutsWithFirstOrder,
    notifyRatePct,
    firstOrderRatePct,
  }
}

export async function loadExpansionCountryFunnels(
  countries: Array<{ countryIso2: string; waitlistCount: number; openedAt: string | null }>
): Promise<Map<string, ExpansionCountryFunnel>> {
  const marketRegion = MARKET_REGION
  const countryCodes = countries.map((row) => row.countryIso2)

  const [notifiedGroups, followUpGroups] = await Promise.all([
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion,
        countryIso2: { in: countryCodes },
        launchNotifiedAt: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: {
        marketRegion,
        countryIso2: { in: countryCodes },
        launchFollowUpSentAt: { not: null },
      },
      _count: { _all: true },
    }),
  ])

  const notifiedMap = new Map(notifiedGroups.map((row) => [row.countryIso2, row._count._all]))
  const followUpMap = new Map(followUpGroups.map((row) => [row.countryIso2, row._count._all]))

  const orderCounts = await Promise.all(
    countries.map(async (row) => {
      if (!row.openedAt) return [row.countryIso2, 0] as const
      const count = await countPaidOrdersForCountrySince(
        row.countryIso2,
        new Date(row.openedAt)
      )
      return [row.countryIso2, count] as const
    })
  )
  const ordersMap = new Map(orderCounts)

  const result = new Map<string, ExpansionCountryFunnel>()
  for (const row of countries) {
    const notifiedCount = notifiedMap.get(row.countryIso2) ?? 0
    const followUpCount = followUpMap.get(row.countryIso2) ?? 0
    const paidOrdersSinceOpen = ordersMap.get(row.countryIso2) ?? 0
    const notifyRatePct =
      row.waitlistCount > 0 ? Math.round((notifiedCount / row.waitlistCount) * 1000) / 10 : 0
    const orderRatePct =
      notifiedCount > 0 ? Math.round((paidOrdersSinceOpen / notifiedCount) * 1000) / 10 : 0

    result.set(row.countryIso2, {
      countryIso2: row.countryIso2,
      notifiedCount,
      followUpCount,
      paidOrdersSinceOpen,
      notifyRatePct,
      orderRatePct,
    })
  }

  return result
}
