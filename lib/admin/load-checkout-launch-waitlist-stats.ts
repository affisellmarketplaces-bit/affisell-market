import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type CheckoutLaunchWaitlistStats = {
  total: number
  topCountry: string | null
  topCountryCount: number
}

export async function loadCheckoutLaunchWaitlistStats(): Promise<CheckoutLaunchWaitlistStats> {
  const marketRegion = MARKET_REGION

  const [total, grouped] = await Promise.all([
    prisma.checkoutLaunchWaitlist.count({ where: { marketRegion } }),
    prisma.checkoutLaunchWaitlist.groupBy({
      by: ["countryIso2"],
      where: { marketRegion },
      _count: { _all: true },
    }),
  ])

  const top = [...grouped].sort((a, b) => b._count._all - a._count._all)[0]
  return {
    total,
    topCountry: top?.countryIso2 ?? null,
    topCountryCount: top?._count._all ?? 0,
  }
}
