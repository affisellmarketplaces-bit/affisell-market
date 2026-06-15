import type { ExpansionComplaintRow } from "@/lib/admin/load-expansion-complaint-rows"

export const EXPANSION_COMPLAINT_CSV_FILENAME = "affisell-expansion-complaints-this-month.csv"

export function expansionComplaintCsvFilename(countryIso2?: string, emailKind?: string): string {
  const countryPart = countryIso2 ? `-${countryIso2.toLowerCase()}` : ""
  const kindPart = emailKind ? `-${emailKind}` : ""
  if (!countryPart && !kindPart) return EXPANSION_COMPLAINT_CSV_FILENAME
  return `affisell-expansion-complaints${countryPart}${kindPart}-this-month.csv`
}

const CSV_COLUMNS = ["countryIso2", "emailKind", "buyerEmailHash", "complainedAt"] as const

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildExpansionComplaintCsv(rows: ExpansionComplaintRow[]): string {
  const bom = "\uFEFF"
  const header = CSV_COLUMNS.join(";")
  const body = rows
    .map((row) =>
      [row.countryIso2, row.emailKind, row.buyerEmailHash ?? "", row.complainedAt.toISOString()]
        .map((cell) => escapeCsvCell(cell))
        .join(";")
    )
    .join("\n")
  return `${bom}${header}\n${body}${body ? "\n" : ""}`
}
