import { prisma } from "@/lib/prisma"

export type ExpansionCountryComplaintsSinceMap = Map<string, number>

function parseCountryFromMeta(error: string | null | undefined): string | null {
  if (!error) return null
  const countryRaw = error.split(":")[0]?.trim().toLowerCase()
  return countryRaw && countryRaw.length === 2 ? countryRaw : null
}

function parseKindFromMeta(error: string | null | undefined): string | null {
  if (!error) return null
  const parts = error.split(":")
  const kind = parts.length >= 2 ? parts[1]?.trim() : null
  return kind && kind.length > 0 ? kind : null
}

export async function loadExpansionCountryComplaintsSince(
  since: Date
): Promise<ExpansionCountryComplaintsSinceMap> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      id: { startsWith: "expansion:complaint:" },
      createdAt: { gte: since },
    },
    select: { error: true },
  })

  const map: ExpansionCountryComplaintsSinceMap = new Map()

  for (const row of rows) {
    const countryIso2 = parseCountryFromMeta(row.error)
    if (!countryIso2) continue
    map.set(countryIso2, (map.get(countryIso2) ?? 0) + 1)
  }

  return map
}

export async function loadExpansionGraduatedComplaintsByCountry(
  now = new Date(),
  monthStart?: Date
): Promise<Map<string, number>> {
  const start =
    monthStart ??
    (() => {
      const s = new Date(now)
      s.setUTCDate(1)
      s.setUTCHours(0, 0, 0, 0)
      return s
    })()

  const rows = await prisma.processedWebhook.findMany({
    where: {
      id: { startsWith: "expansion:complaint:" },
      createdAt: { gte: start },
    },
    select: { error: true },
  })

  const map = new Map<string, number>()

  for (const row of rows) {
    if (parseKindFromMeta(row.error) !== "checkout-graduated") continue
    const countryIso2 = parseCountryFromMeta(row.error)
    if (!countryIso2) continue
    map.set(countryIso2, (map.get(countryIso2) ?? 0) + 1)
  }

  return map
}
