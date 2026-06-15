import { prisma } from "@/lib/prisma"

export type ExpansionBounceRow = {
  countryIso2: string
  emailKind: string
  bouncedAt: Date
}

function parseBounceMeta(error: string | null | undefined): {
  countryIso2: string | null
  emailKind: string
} {
  if (!error) return { countryIso2: null, emailKind: "unknown" }
  const [countryRaw, kindRaw] = error.split(":")
  const countryIso2 = countryRaw?.trim().toLowerCase()
  return {
    countryIso2: countryIso2 && countryIso2.length === 2 ? countryIso2 : null,
    emailKind: kindRaw?.trim() || "unknown",
  }
}

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export async function loadExpansionBounceRows(
  countryIso2?: string,
  now = new Date()
): Promise<ExpansionBounceRow[]> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      id: { startsWith: "expansion:bounce:" },
      createdAt: { gte: monthStartUtc(now) },
      ...(countryIso2 ? { error: { startsWith: `${countryIso2.toLowerCase()}:` } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { error: true, createdAt: true },
    take: 5000,
  })

  return rows
    .map((row) => {
      const meta = parseBounceMeta(row.error)
      if (!meta.countryIso2) return null
      return {
        countryIso2: meta.countryIso2,
        emailKind: meta.emailKind,
        bouncedAt: row.createdAt,
      }
    })
    .filter((row): row is ExpansionBounceRow => row !== null)
}
