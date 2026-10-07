/**
 * Listing readiness — the single definition of "this physical product may be published", shared by the API (which
 * enforces it) and the forms (which show it live). Pure and client-safe: no Prisma, no I/O.
 *
 * What it checks is PRESENCE and FORMAT of the declared data, never its truth: the supplier remains the one declaring
 * who the manufacturer / EU responsible person is.
 */
import { isEuCountry, isCountryCode, normalizeCountryCode } from "@/lib/listing-compliance/eu-countries"
import { isValidGtin } from "@/lib/listing-compliance/gtin"
import { GPSR_KEYS, IDENTITY_KEYS } from "@/lib/listing-compliance/keys"

export type ReadinessGroup = "gpsr" | "identity"
export type ReadinessSeverity = "blocking" | "advisory"

/** Every code the evaluator can emit — also what the translation catalogues must cover (see the i18n test). */
export const READINESS_ISSUE_CODES = [
  "gpsr_manufacturer_name_missing",
  "gpsr_manufacturer_address_missing",
  "gpsr_manufacturer_email_missing",
  "gpsr_manufacturer_email_invalid",
  "gpsr_manufacturer_country_missing",
  "gpsr_manufacturer_country_invalid",
  "gpsr_eu_rep_name_missing",
  "gpsr_eu_rep_address_missing",
  "gpsr_eu_rep_email_missing",
  "gpsr_eu_rep_email_invalid",
  "gtin_invalid",
  "gtin_missing",
  "brand_missing",
] as const

export type ReadinessIssueCode = (typeof READINESS_ISSUE_CODES)[number]

export type ReadinessIssue = {
  code: ReadinessIssueCode
  /** The attribute key to focus to fix it. */
  field: string
  group: ReadinessGroup
  severity: ReadinessSeverity
}

export type ReadinessInput = {
  /** `Product.listingKind`; only physical goods fall under product-safety rules. Unknown / empty = PHYSICAL (DB default). */
  listingKind?: string | null
  attributes: ReadonlyArray<{ key: string; value: string }> | Readonly<Record<string, string | undefined | null>>
}

export type ReadinessResult = {
  /** False for digital goods, services and experiences: nothing to check. */
  applicable: boolean
  issues: ReadinessIssue[]
  blocking: ReadinessIssue[]
  advisory: ReadinessIssue[]
  /** True when no blocking issue remains (advisories never prevent publishing). */
  ready: boolean
}

// Same rule as lib/legal/gpsr-compliance-shared.ts (kept identical by a test).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GENERIC_BRANDS = new Set(["", "generique", "générique", "generic", "no brand", "sans marque", "n/a", "na", "-"])

function toRecord(attributes: ReadinessInput["attributes"]): Record<string, string> {
  const out: Record<string, string> = {}
  if (Array.isArray(attributes)) {
    for (const row of attributes as ReadonlyArray<{ key: string; value: string }>) {
      if (row && typeof row.key === "string") out[row.key] = String(row.value ?? "").trim()
    }
  } else {
    for (const [k, v] of Object.entries(attributes as Record<string, string | undefined | null>)) {
      out[k] = String(v ?? "").trim()
    }
  }
  return out
}

const issue = (
  code: ReadinessIssueCode,
  field: string,
  group: ReadinessGroup,
  severity: ReadinessSeverity
): ReadinessIssue => ({ code, field, group, severity })

export function evaluateListingReadiness(input: ReadinessInput): ReadinessResult {
  const kind = (input.listingKind ?? "PHYSICAL").toString().trim().toUpperCase() || "PHYSICAL"
  if (kind !== "PHYSICAL") {
    return { applicable: false, issues: [], blocking: [], advisory: [], ready: true }
  }

  const a = toRecord(input.attributes)
  const issues: ReadinessIssue[] = []
  const blocking = (code: ReadinessIssueCode, field: string, group: ReadinessGroup) =>
    issues.push(issue(code, field, group, "blocking"))
  const advisory = (code: ReadinessIssueCode, field: string, group: ReadinessGroup) =>
    issues.push(issue(code, field, group, "advisory"))

  // ---- GPSR: the manufacturer ------------------------------------------------------------------------------------
  if (!a[GPSR_KEYS.manufacturerName]) blocking("gpsr_manufacturer_name_missing", GPSR_KEYS.manufacturerName, "gpsr")
  if (!a[GPSR_KEYS.manufacturerAddress]) blocking("gpsr_manufacturer_address_missing", GPSR_KEYS.manufacturerAddress, "gpsr")
  const mEmail = a[GPSR_KEYS.manufacturerEmail] ?? ""
  if (!mEmail) blocking("gpsr_manufacturer_email_missing", GPSR_KEYS.manufacturerEmail, "gpsr")
  else if (!EMAIL.test(mEmail)) blocking("gpsr_manufacturer_email_invalid", GPSR_KEYS.manufacturerEmail, "gpsr")

  // ---- GPSR: a manufacturer outside the EU needs an EU responsible person ------------------------------------------
  const country = a[GPSR_KEYS.manufacturerCountry] ?? ""
  let euRepRequired = false
  if (!country) blocking("gpsr_manufacturer_country_missing", GPSR_KEYS.manufacturerCountry, "gpsr")
  else if (!isCountryCode(country)) blocking("gpsr_manufacturer_country_invalid", GPSR_KEYS.manufacturerCountry, "gpsr")
  else euRepRequired = !isEuCountry(normalizeCountryCode(country))

  if (euRepRequired) {
    if (!a[GPSR_KEYS.euRepName]) blocking("gpsr_eu_rep_name_missing", GPSR_KEYS.euRepName, "gpsr")
    if (!a[GPSR_KEYS.euRepAddress]) blocking("gpsr_eu_rep_address_missing", GPSR_KEYS.euRepAddress, "gpsr")
    const rEmail = a[GPSR_KEYS.euRepEmail] ?? ""
    if (!rEmail) blocking("gpsr_eu_rep_email_missing", GPSR_KEYS.euRepEmail, "gpsr")
    else if (!EMAIL.test(rEmail)) blocking("gpsr_eu_rep_email_invalid", GPSR_KEYS.euRepEmail, "gpsr")
  }

  // ---- Identity ----------------------------------------------------------------------------------------------------
  const gtin = a[IDENTITY_KEYS.gtin] ?? ""
  if (gtin) {
    if (!isValidGtin(gtin)) blocking("gtin_invalid", IDENTITY_KEYS.gtin, "identity")
  } else if (a[IDENTITY_KEYS.gtinExempt] !== "1") {
    advisory("gtin_missing", IDENTITY_KEYS.gtin, "identity")
  }
  if (GENERIC_BRANDS.has((a[IDENTITY_KEYS.brand] ?? "").toLowerCase())) {
    advisory("brand_missing", IDENTITY_KEYS.brand, "identity")
  }

  const blockingIssues = issues.filter((i) => i.severity === "blocking")
  return {
    applicable: true,
    issues,
    blocking: blockingIssues,
    advisory: issues.filter((i) => i.severity === "advisory"),
    ready: blockingIssues.length === 0,
  }
}
