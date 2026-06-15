import { prisma } from "@/lib/prisma"

export type ExpansionCountryComplaintStats = {
  complaintsThisMonth: number
}

export type ExpansionCountryComplaintStatsMap = Map<string, ExpansionCountryComplaintStats>

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function parseCountryFromMeta(error: string | null | undefined): string | null {
  if (!error) return null
  const countryRaw = error.split(":")[0]?.trim().toLowerCase()
  return countryRaw && countryRaw.length === 2 ? countryRaw : null
}

export async function loadExpansionCountryComplaintStats(
  now = new Date()
): Promise<ExpansionCountryComplaintStatsMap> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      id: { startsWith: "expansion:complaint:" },
      createdAt: { gte: monthStartUtc(now) },
    },
    select: { error: true },
  })

  const map: ExpansionCountryComplaintStatsMap = new Map()

  for (const row of rows) {
    const countryIso2 = parseCountryFromMeta(row.error)
    if (!countryIso2) continue
    const existing = map.get(countryIso2)?.complaintsThisMonth ?? 0
    map.set(countryIso2, { complaintsThisMonth: existing + 1 })
  }

  return map
}
