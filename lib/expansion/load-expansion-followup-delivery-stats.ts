import { prisma } from "@/lib/prisma"

export type ExpansionCountryFollowupDeliveryStats = {
  followupDeliveredThisMonth: number
}

export type ExpansionCountryFollowupDeliveryStatsMap = Map<
  string,
  ExpansionCountryFollowupDeliveryStats
>

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function parseCountryAndKind(error: string | null | undefined): {
  countryIso2: string | null
  emailKind: string | null
} {
  if (!error) return { countryIso2: null, emailKind: null }
  const [countryRaw, kindRaw] = error.split(":")
  const countryIso2 = countryRaw?.trim().toLowerCase()
  return {
    countryIso2: countryIso2 && countryIso2.length === 2 ? countryIso2 : null,
    emailKind: kindRaw?.trim() || null,
  }
}

export async function loadExpansionFollowupDeliveryStatsByCountry(
  now = new Date()
): Promise<ExpansionCountryFollowupDeliveryStatsMap> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      status: "expansion_delivered",
      createdAt: { gte: monthStartUtc(now) },
    },
    select: { error: true },
  })

  const map: ExpansionCountryFollowupDeliveryStatsMap = new Map()

  for (const row of rows) {
    const meta = parseCountryAndKind(row.error)
    if (meta.emailKind !== "checkout-launch-followup" || !meta.countryIso2) continue
    const existing = map.get(meta.countryIso2)?.followupDeliveredThisMonth ?? 0
    map.set(meta.countryIso2, { followupDeliveredThisMonth: existing + 1 })
  }

  return map
}
