import type { ExpansionEmailEventRow } from "@/lib/admin/load-expansion-email-event-rows"

export const EXPANSION_EMAIL_EVENTS_CSV_FILENAME = "affisell-expansion-email-events-this-month.csv"

export function expansionEmailEventsCsvFilename(countryIso2?: string, emailKind?: string): string {
  const countryPart = countryIso2 ? `-${countryIso2.toLowerCase()}` : ""
  const kindPart = emailKind ? `-${emailKind}` : ""
  if (!countryPart && !kindPart) return EXPANSION_EMAIL_EVENTS_CSV_FILENAME
  return `affisell-expansion-email-events${countryPart}${kindPart}-this-month.csv`
}

const CSV_COLUMNS = ["eventType", "countryIso2", "emailKind", "occurredAt"] as const

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildExpansionEmailEventsCsv(rows: ExpansionEmailEventRow[]): string {
  const bom = "\uFEFF"
  const header = CSV_COLUMNS.join(";")
  const body = rows
    .map((row) =>
      [row.eventType, row.countryIso2, row.emailKind, row.occurredAt.toISOString()]
        .map((cell) => escapeCsvCell(cell))
        .join(";")
    )
    .join("\n")
  return `${bom}${header}\n${body}${body ? "\n" : ""}`
}
