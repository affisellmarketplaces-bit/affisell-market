import type { AdminTermsLogRow } from "@/lib/admin/terms-logs/types"
import { TERMS_LOGS_CSV_COLUMNS } from "@/lib/admin/terms-logs/types"

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildTermsLogsCsv(rows: AdminTermsLogRow[]): string {
  const headerLine = TERMS_LOGS_CSV_COLUMNS.map(escapeCsvCell).join(";")
  const dataLines = rows.map((row) =>
    [
      row.userId,
      row.email,
      row.type,
      row.version,
      row.ip,
      row.userAgent,
      row.createdAt,
    ]
      .map(escapeCsvCell)
      .join(";")
  )
  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}\r\n`
}
