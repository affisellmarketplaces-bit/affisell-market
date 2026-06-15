import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type SuppressedWaitlistRow = {
  email: string
  countryIso2: string
  locale: string | null
  createdAt: Date
  launchEmailBouncedAt: Date | null
  launchEmailSuppressedAt: Date | null
  launchNotifiedAt: Date | null
}

export async function loadSuppressedWaitlistRows(
  countryIso2?: string
): Promise<SuppressedWaitlistRow[]> {
  return prisma.checkoutLaunchWaitlist.findMany({
    where: {
      marketRegion: MARKET_REGION,
      launchEmailSuppressedAt: { not: null },
      ...(countryIso2 ? { countryIso2 } : {}),
    },
    orderBy: [{ countryIso2: "asc" }, { launchEmailSuppressedAt: "desc" }],
    select: {
      email: true,
      countryIso2: true,
      locale: true,
      createdAt: true,
      launchEmailBouncedAt: true,
      launchEmailSuppressedAt: true,
      launchNotifiedAt: true,
    },
  })
}
