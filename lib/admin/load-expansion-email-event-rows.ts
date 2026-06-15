import type { ExpansionBounceRow } from "@/lib/admin/load-expansion-bounce-rows"
import type { ExpansionComplaintRow } from "@/lib/admin/load-expansion-complaint-rows"
import { loadExpansionBounceRows } from "@/lib/admin/load-expansion-bounce-rows"
import { loadExpansionComplaintRows } from "@/lib/admin/load-expansion-complaint-rows"
import { loadExpansionDeliveredRows } from "@/lib/admin/load-expansion-delivered-rows"

export type ExpansionEmailEventRow = {
  eventType: "delivered" | "bounce" | "complaint"
  countryIso2: string
  emailKind: string
  occurredAt: Date
}

export async function loadExpansionEmailEventRows(
  countryIso2?: string,
  emailKind?: string,
  now = new Date()
): Promise<ExpansionEmailEventRow[]> {
  const [delivered, bounces, complaints] = await Promise.all([
    loadExpansionDeliveredRows(countryIso2, now),
    loadExpansionBounceRows(countryIso2, now),
    loadExpansionComplaintRows(countryIso2, now),
  ])

  const rows: ExpansionEmailEventRow[] = [
    ...delivered.map((row) => ({
      eventType: "delivered" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      occurredAt: row.deliveredAt,
    })),
    ...bounces.map((row: ExpansionBounceRow) => ({
      eventType: "bounce" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      occurredAt: row.bouncedAt,
    })),
    ...complaints.map((row: ExpansionComplaintRow) => ({
      eventType: "complaint" as const,
      countryIso2: row.countryIso2,
      emailKind: row.emailKind,
      occurredAt: row.complainedAt,
    })),
  ]

  const filtered = emailKind ? rows.filter((row) => row.emailKind === emailKind) : rows

  return filtered.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}
