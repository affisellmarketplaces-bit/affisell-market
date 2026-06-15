import { prisma } from "@/lib/prisma"
import { parseExpansionEmailEventMeta } from "@/lib/expansion/expansion-email-event-meta"

export type ExpansionDeliveredRow = {
  countryIso2: string
  emailKind: string
  buyerEmailHash: string | null
  deliveredAt: Date
}

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export async function loadExpansionDeliveredRows(
  countryIso2?: string,
  emailKind?: string,
  now = new Date()
): Promise<ExpansionDeliveredRow[]> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      status: "expansion_delivered",
      createdAt: { gte: monthStartUtc(now) },
      ...(countryIso2 ? { error: { startsWith: `${countryIso2.toLowerCase()}:` } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { error: true, createdAt: true },
    take: 5000,
  })

  const mapped = rows
    .map((row) => {
      const meta = parseExpansionEmailEventMeta(row.error)
      if (!meta.countryIso2) return null
      return {
        countryIso2: meta.countryIso2,
        emailKind: meta.emailKind,
        buyerEmailHash: meta.buyerEmailHash,
        deliveredAt: row.createdAt,
      }
    })
    .filter((row): row is ExpansionDeliveredRow => row !== null)

  return emailKind ? mapped.filter((row) => row.emailKind === emailKind) : mapped
}
