import type { SuppressedWaitlistRow } from "@/lib/admin/load-suppressed-waitlist-rows"
import { SUPPRESSED_WAITLIST_EMAIL_KIND } from "@/lib/admin/load-suppressed-waitlist-rows"

export { SUPPRESSED_WAITLIST_EMAIL_KIND } from "@/lib/admin/load-suppressed-waitlist-rows"

export const SUPPRESSED_WAITLIST_CSV_FILENAME = "affisell-expansion-suppressed-waitlist.csv"

export function suppressedWaitlistCsvFilename(countryIso2?: string, emailKind?: string): string {
  const countryPart = countryIso2 ? `-${countryIso2.toLowerCase()}` : ""
  const kindPart = emailKind ? `-${emailKind}` : ""
  if (!countryPart && !kindPart) return SUPPRESSED_WAITLIST_CSV_FILENAME
  return `affisell-expansion-suppressed-waitlist${countryPart}${kindPart}.csv`
}

const CSV_COLUMNS = [
  "emailKind",
  "email",
  "countryIso2",
  "locale",
  "createdAt",
  "launchEmailBouncedAt",
  "launchEmailSuppressedAt",
  "launchNotifiedAt",
] as const

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString() : ""
}

export function buildSuppressedWaitlistCsv(rows: SuppressedWaitlistRow[]): string {
  const bom = "\uFEFF"
  const header = CSV_COLUMNS.join(";")
  const body = rows
    .map((row) =>
      [
        SUPPRESSED_WAITLIST_EMAIL_KIND,
        row.email,
        row.countryIso2,
        row.locale ?? "",
        formatDate(row.createdAt),
        formatDate(row.launchEmailBouncedAt),
        formatDate(row.launchEmailSuppressedAt),
        formatDate(row.launchNotifiedAt),
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(";")
    )
    .join("\n")
  return `${bom}${header}\n${body}${body ? "\n" : ""}`
}
