import { prisma } from "@/lib/prisma"

export type ExpansionComplaintRow = {
  countryIso2: string
  emailKind: string
  complainedAt: Date
}

function parseComplaintMeta(error: string | null | undefined): {
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

export async function loadExpansionComplaintRows(
  countryIso2?: string,
  now = new Date()
): Promise<ExpansionComplaintRow[]> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      id: { startsWith: "expansion:complaint:" },
      createdAt: { gte: monthStartUtc(now) },
      ...(countryIso2 ? { error: { startsWith: `${countryIso2.toLowerCase()}:` } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { error: true, createdAt: true },
    take: 5000,
  })

  return rows
    .map((row) => {
      const meta = parseComplaintMeta(row.error)
      if (!meta.countryIso2) return null
      return {
        countryIso2: meta.countryIso2,
        emailKind: meta.emailKind,
        complainedAt: row.createdAt,
      }
    })
    .filter((row): row is ExpansionComplaintRow => row !== null)
}
