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
