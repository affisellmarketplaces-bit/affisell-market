import type { ExpansionBounceRow } from "@/lib/admin/load-expansion-bounce-rows"

export const EXPANSION_BOUNCE_CSV_FILENAME = "affisell-expansion-bounces-this-month.csv"

const CSV_COLUMNS = ["countryIso2", "emailKind", "buyerEmailHash", "bouncedAt"] as const

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildExpansionBounceCsv(rows: ExpansionBounceRow[]): string {
  const bom = "\uFEFF"
  const header = CSV_COLUMNS.join(";")
  const body = rows
    .map((row) =>
      [row.countryIso2, row.emailKind, row.buyerEmailHash ?? "", row.bouncedAt.toISOString()]
        .map((cell) => escapeCsvCell(cell))
        .join(";")
    )
    .join("\n")
  return `${bom}${header}\n${body}${body ? "\n" : ""}`
}
