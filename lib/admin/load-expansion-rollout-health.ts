import { findGraduationEmailStalls } from "@/lib/expansion/graduation-email-stall"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

const STALL_MS = 7 * 24 * 60 * 60 * 1000

export type ExpansionRolloutHealthStats = {
  enabledCount: number
  awaitingFirstOrder: number
  stalledCount: number
  stalledCountries: string[]
  graduationEmailStallCount: number
  graduationEmailStallCountries: string[]
}

export async function loadExpansionRolloutHealthStats(): Promise<ExpansionRolloutHealthStats> {
  const marketRegion = MARKET_REGION
  const stallBefore = new Date(Date.now() - STALL_MS)

  const rollouts = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion, enabled: true },
    select: { countryIso2: true, firstOrderAt: true, openedAt: true },
  })

  const awaiting = rollouts.filter((row) => !row.firstOrderAt)
  const stalled = awaiting.filter((row) => row.openedAt <= stallBefore)

  const graduationPending = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion,
      graduatedAt: { not: null },
      graduationEmailSentAt: null,
    },
    select: { countryIso2: true, graduatedAt: true },
  })
  const graduationStalls = findGraduationEmailStalls(
    graduationPending.map((row) => ({
      countryIso2: row.countryIso2,
      graduatedAt: row.graduatedAt!,
    }))
  )

  return {
    enabledCount: rollouts.length,
    awaitingFirstOrder: awaiting.length,
    stalledCount: stalled.length,
    stalledCountries: stalled.map((row) => row.countryIso2),
    graduationEmailStallCount: graduationStalls.length,
    graduationEmailStallCountries: graduationStalls.map((row) => row.countryIso2),
  }
}
