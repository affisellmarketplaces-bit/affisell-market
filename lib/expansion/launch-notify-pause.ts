import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export function launchNotifyPauseId(countryIso2: string): string {
  return `expansion:launch-notify-paused:${MARKET_REGION}:${countryIso2.toLowerCase()}`
}

export async function isLaunchNotifyPaused(countryIso2: string): Promise<boolean> {
  const row = await prisma.processedWebhook.findUnique({
    where: { id: launchNotifyPauseId(countryIso2) },
  })
  return Boolean(row)
}

export async function pauseLaunchNotifyCountry(
  countryIso2: string,
  reason: string
): Promise<boolean> {
  const id = launchNotifyPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) return false

  await prisma.processedWebhook.create({
    data: { id, status: "success", error: reason.slice(0, 500) },
  })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "launch_notify_paused",
    reason,
  })

  return true
}

export async function resumeLaunchNotifyCountry(countryIso2: string): Promise<boolean> {
  const id = launchNotifyPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (!existing) return false

  await prisma.processedWebhook.delete({ where: { id } })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "launch_notify_resumed",
  })

  return true
}

export async function loadPausedLaunchNotifyCountries(): Promise<Set<string>> {
  const prefix = `expansion:launch-notify-paused:${MARKET_REGION}:`
  const rows = await prisma.processedWebhook.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  })
  return new Set(
    rows
      .map((row) => row.id.slice(prefix.length).toLowerCase())
      .filter((code) => code.length === 2)
  )
}
