/**
 * Reserved `ProductAttribute` keys for listing identity and product-safety (GPSR) data.
 *
 * Why attributes and not columns on `Product`: `prisma migrate deploy` is warn-only in the Vercel build, so a column added to
 * the hottest table of the app could reach production code before it exists in the database and fail every product query.
 * `ProductAttribute` is an existing table, already indexed on (key, value) — which is also what duplicate detection needs.
 *
 * Client-safe (no Prisma).
 */

/** Same keys as the category attribute definitions (`brand`, `ean`): one source of truth, no parallel fields. */
export const IDENTITY_KEYS = {
  brand: "brand",
  /** GTIN-8/12/13/14 (EAN/UPC). The key predates this module (category attribute "ean"), so it is kept. */
  gtin: "ean",
  mpn: "mpn",
  /** "1" when the supplier declares the product has no GTIN (handmade, custom, private label). */
  gtinExempt: "gtin_exempt",
} as const

/** GPSR (EU 2023/988) economic-operator and safety information. The first five keys predate this module (guided wizard). */
export const GPSR_KEYS = {
  manufacturerName: "gpsr_manufacturer_name",
  manufacturerAddress: "gpsr_manufacturer_address",
  manufacturerEmail: "gpsr_manufacturer_email",
  safetyWarning: "gpsr_safety_warning",
  notice: "gpsr_notice",
  /** ISO 3166-1 alpha-2 of the manufacturer's establishment — decides whether an EU responsible person is required. */
  manufacturerCountry: "gpsr_manufacturer_country",
  euRepName: "gpsr_eu_rep_name",
  euRepAddress: "gpsr_eu_rep_address",
  euRepEmail: "gpsr_eu_rep_email",
  /** Type / batch / serial reference that identifies the product (GPSR art. 9). */
  traceability: "gpsr_traceability",
} as const

export type IdentityKey = (typeof IDENTITY_KEYS)[keyof typeof IDENTITY_KEYS]
export type GpsrKey = (typeof GPSR_KEYS)[keyof typeof GPSR_KEYS]

/** Every key the listing-compliance UI owns (what a form declares in `managedAttributeKeys`). */
export const LISTING_COMPLIANCE_KEYS: readonly string[] = [
  ...Object.values(IDENTITY_KEYS),
  ...Object.values(GPSR_KEYS),
]

const RESERVED = new Set<string>(LISTING_COMPLIANCE_KEYS)

export function isListingComplianceKey(key: string): boolean {
  return RESERVED.has(key)
}

/** Canonical (English) labels stored with new rows. Display is translated from the KEY, never from the stored label. */
export const CANONICAL_LABELS: Record<string, string> = {
  [IDENTITY_KEYS.brand]: "Brand",
  [IDENTITY_KEYS.gtin]: "GTIN / EAN",
  [IDENTITY_KEYS.mpn]: "Manufacturer part number",
  [IDENTITY_KEYS.gtinExempt]: "No GTIN",
  [GPSR_KEYS.manufacturerName]: "Manufacturer",
  [GPSR_KEYS.manufacturerAddress]: "Manufacturer address",
  [GPSR_KEYS.manufacturerEmail]: "Manufacturer email",
  [GPSR_KEYS.safetyWarning]: "Safety warning",
  [GPSR_KEYS.notice]: "Instructions",
  [GPSR_KEYS.manufacturerCountry]: "Manufacturer country",
  [GPSR_KEYS.euRepName]: "EU responsible person",
  [GPSR_KEYS.euRepAddress]: "EU responsible person address",
  [GPSR_KEYS.euRepEmail]: "EU responsible person email",
  [GPSR_KEYS.traceability]: "Batch / serial reference",
}
