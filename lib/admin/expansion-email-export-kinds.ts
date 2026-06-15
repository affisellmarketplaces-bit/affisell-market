export const EXPANSION_EMAIL_EXPORT_KINDS = [
  "checkout-launch",
  "checkout-launch-followup",
  "checkout-graduated",
] as const

export type ExpansionEmailExportKind = (typeof EXPANSION_EMAIL_EXPORT_KINDS)[number]

export const EXPANSION_EMAIL_EXPORTS_BUNDLE_FILENAME =
  "affisell-expansion-email-exports-this-month.zip"

export function expansionEmailExportsBundleFilename(countryIso2?: string): string {
  if (!countryIso2) return EXPANSION_EMAIL_EXPORTS_BUNDLE_FILENAME
  return `affisell-expansion-email-exports-${countryIso2.toLowerCase()}-this-month.zip`
}

export function expansionEmailExportsBundlePath(countryIso2?: string): string {
  const params = new URLSearchParams()
  if (countryIso2) params.set("countryIso2", countryIso2.toLowerCase())
  const query = params.toString()
  return query
    ? `/api/admin/expansion/email-exports-bundle?${query}`
    : "/api/admin/expansion/email-exports-bundle"
}

export function expansionBouncesExportPath(
  countryIso2?: string,
  emailKind?: ExpansionEmailExportKind
): string {
  const params = new URLSearchParams()
  if (countryIso2) params.set("countryIso2", countryIso2.toLowerCase())
  if (emailKind) params.set("emailKind", emailKind)
  const query = params.toString()
  return query
    ? `/api/admin/expansion/bounces-export?${query}`
    : "/api/admin/expansion/bounces-export"
}
