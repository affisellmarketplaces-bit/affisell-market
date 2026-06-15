import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export function graduationEmailPauseId(countryIso2: string): string {
  return `expansion:graduation-email-paused:${MARKET_REGION}:${countryIso2.toLowerCase()}`
}

export async function isGraduationEmailPaused(countryIso2: string): Promise<boolean> {
  const row = await prisma.processedWebhook.findUnique({
    where: { id: graduationEmailPauseId(countryIso2) },
  })
  return Boolean(row)
}

export async function pauseGraduationEmailCountry(
  countryIso2: string,
  reason: string
): Promise<boolean> {
  const id = graduationEmailPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) return false

  await prisma.processedWebhook.create({
    data: { id, status: "success", error: reason.slice(0, 500) },
  })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "graduation_email_paused",
    reason,
  })

  return true
}

export async function resumeGraduationEmailCountry(countryIso2: string): Promise<boolean> {
  const id = graduationEmailPauseId(countryIso2)
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (!existing) return false

  await prisma.processedWebhook.delete({ where: { id } })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "graduation_email_resumed",
  })

  return true
}

export async function loadPausedGraduationEmailCountries(): Promise<Set<string>> {
  const prefix = `expansion:graduation-email-paused:${MARKET_REGION}:`
  const rows = await prisma.processedWebhook.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  })

  const set = new Set<string>()
  for (const row of rows) {
    const countryIso2 = row.id.slice(prefix.length).toLowerCase()
    if (countryIso2.length === 2) set.add(countryIso2)
  }
  return set
}
