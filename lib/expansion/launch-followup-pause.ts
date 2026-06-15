import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export function launchFollowupPauseId(countryIso2: string): string {
  return `expansion:launch-followup-paused:${MARKET_REGION}:${countryIso2.toLowerCase()}`
}

export async function isLaunchFollowupPaused(countryIso2: string): Promise<boolean> {
  const row = await prisma.processedWebhook.findUnique({
    where: { id: launchFollowupPauseId(countryIso2) },
  })
  return Boolean(row)
}

export async function pauseLaunchFollowupCountry(
  countryIso2: string,
  reason: string
): Promise<boolean> {
  const id = launchFollowupPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) return false

  await prisma.processedWebhook.create({
    data: { id, status: "success", error: reason.slice(0, 500) },
  })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "launch_followup_paused",
    reason,
  })

  return true
}

export async function resumeLaunchFollowupCountry(countryIso2: string): Promise<boolean> {
  const id = launchFollowupPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (!existing) return false

  await prisma.processedWebhook.delete({ where: { id } })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "launch_followup_resumed",
  })

  return true
}

export async function loadPausedLaunchFollowupCountries(): Promise<Set<string>> {
  const details = await loadPausedLaunchFollowupDetails()
  return new Set(details.keys())
}

export async function loadPausedLaunchFollowupDetails(): Promise<
  Map<string, { reason: string | null }>
> {
  const prefix = `expansion:launch-followup-paused:${MARKET_REGION}:`
  const rows = await prisma.processedWebhook.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true, error: true },
  })

  const map = new Map<string, { reason: string | null }>()

  for (const row of rows) {
    const countryIso2 = row.id.slice(prefix.length).toLowerCase()
    if (countryIso2.length !== 2) continue
    map.set(countryIso2, { reason: row.error ?? null })
  }

  return map
}
