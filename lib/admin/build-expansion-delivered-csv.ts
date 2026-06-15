import type { ExpansionDeliveredRow } from "@/lib/admin/load-expansion-delivered-rows"

export const EXPANSION_DELIVERED_CSV_FILENAME = "affisell-expansion-delivered-this-month.csv"

export function expansionDeliveredCsvFilename(countryIso2?: string, emailKind?: string): string {
  const countryPart = countryIso2 ? `-${countryIso2.toLowerCase()}` : ""
  const kindPart = emailKind ? `-${emailKind}` : ""
  if (!countryPart && !kindPart) return EXPANSION_DELIVERED_CSV_FILENAME
  return `affisell-expansion-delivered${countryPart}${kindPart}-this-month.csv`
}

const CSV_COLUMNS = ["countryIso2", "emailKind", "deliveredAt"] as const

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildExpansionDeliveredCsv(rows: ExpansionDeliveredRow[]): string {
  const bom = "\uFEFF"
  const header = CSV_COLUMNS.join(";")
  const body = rows
    .map((row) =>
      [row.countryIso2, row.emailKind, row.deliveredAt.toISOString()]
        .map((cell) => escapeCsvCell(cell))
        .join(";")
    )
    .join("\n")
  return `${bom}${header}\n${body}${body ? "\n" : ""}`
}
