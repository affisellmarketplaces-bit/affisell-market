import type { ExpansionBounceRow } from "@/lib/admin/load-expansion-bounce-rows"
import type { ExpansionComplaintRow } from "@/lib/admin/load-expansion-complaint-rows"
import { loadExpansionBounceRows } from "@/lib/admin/load-expansion-bounce-rows"
import { loadExpansionComplaintRows } from "@/lib/admin/load-expansion-complaint-rows"
import { loadExpansionDeliveredRows } from "@/lib/admin/load-expansion-delivered-rows"

export type ExpansionEmailEventRow = {
  eventType: "delivered" | "bounce" | "complaint"
  countryIso2: string
  emailKind: string
  buyerEmailHash: string | null
  occurredAt: Date
}

export async function loadExpansionEmailEventRows(
  countryIso2?: string,
  emailKind?: string,
  eventType?: ExpansionEmailEventRow["eventType"],
  now = new Date()
): Promise<ExpansionEmailEventRow[]> {
  const [delivered, bounces, complaints] = await Promise.all([
    loadExpansionDeliveredRows(countryIso2, undefined, now),
    loadExpansionBounceRows(countryIso2, undefined, now),
    loadExpansionComplaintRows(countryIso2, undefined, now),
  ])

  const rows: ExpansionEmailEventRow[] = [
    ...delivered.map((row) => ({
      eventType: "delivered" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      buyerEmailHash: row.buyerEmailHash,
      occurredAt: row.deliveredAt,
    })),
    ...bounces.map((row: ExpansionBounceRow) => ({
      eventType: "bounce" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      buyerEmailHash: row.buyerEmailHash,
      occurredAt: row.bouncedAt,
    })),
    ...complaints.map((row: ExpansionComplaintRow) => ({
      eventType: "complaint" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      buyerEmailHash: row.buyerEmailHash,
      occurredAt: row.complainedAt,
    })),
  ]

  const kindFiltered = emailKind ? rows.filter((row) => row.emailKind === emailKind) : rows
  const filtered = eventType ? kindFiltered.filter((row) => row.eventType === eventType) : kindFiltered

  return filtered.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}
