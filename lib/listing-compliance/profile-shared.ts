/**
 * The supplier's reusable GPSR details. Client-safe (no Prisma): the settings screen, the product forms and the API
 * validate with the very same function.
 *
 * It is a DEFAULT to offer in one click — never applied silently. The manufacturer of a given product is whoever made it,
 * and a dropshipper is rarely that; the EU responsible person, on the other hand, is usually constant (the supplier itself
 * or its importer), which is what makes the profile worth having.
 */
import { isCountryCode, normalizeCountryCode } from "@/lib/listing-compliance/eu-countries"
import { GPSR_KEYS } from "@/lib/listing-compliance/keys"

export type ComplianceProfile = {
  manufacturerName: string
  manufacturerAddress: string
  manufacturerEmail: string
  manufacturerCountry: string
  euRepName: string
  euRepAddress: string
  euRepEmail: string
}

export type ComplianceProfileField = keyof ComplianceProfile

export const EMPTY_COMPLIANCE_PROFILE: ComplianceProfile = {
  manufacturerName: "",
  manufacturerAddress: "",
  manufacturerEmail: "",
  manufacturerCountry: "",
  euRepName: "",
  euRepAddress: "",
  euRepEmail: "",
}

export const COMPLIANCE_PROFILE_FIELDS = Object.keys(EMPTY_COMPLIANCE_PROFILE) as ComplianceProfileField[]

const MAX_LEN: Record<ComplianceProfileField, number> = {
  manufacturerName: 200,
  manufacturerAddress: 500,
  manufacturerEmail: 200,
  manufacturerCountry: 2,
  euRepName: 200,
  euRepAddress: 500,
  euRepEmail: 200,
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ComplianceProfileErrorCode = "invalid_email" | "invalid_country" | "too_long"

export type ComplianceProfileParse =
  | { ok: true; value: ComplianceProfile }
  | { ok: false; errors: Partial<Record<ComplianceProfileField, ComplianceProfileErrorCode>> }

/** Unknown keys are ignored; absent fields become "". An empty field is always valid (the profile may be partial). */
export function parseComplianceProfile(raw: unknown): ComplianceProfileParse {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const value: ComplianceProfile = { ...EMPTY_COMPLIANCE_PROFILE }
  const errors: Partial<Record<ComplianceProfileField, ComplianceProfileErrorCode>> = {}

  for (const field of COMPLIANCE_PROFILE_FIELDS) {
    const v = typeof src[field] === "string" ? (src[field] as string).trim() : ""
    value[field] = field === "manufacturerCountry" ? normalizeCountryCode(v) : v
    if (!v) continue
    if (field === "manufacturerCountry") {
      if (!isCountryCode(v)) errors[field] = "invalid_country"
    } else if (v.length > MAX_LEN[field]) {
      errors[field] = "too_long"
    } else if ((field === "manufacturerEmail" || field === "euRepEmail") && !EMAIL.test(v)) {
      errors[field] = "invalid_email"
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value }
}

/** Attribute rows (reserved keys) for the manufacturer block; empty values are skipped. */
export function manufacturerAttributesFromProfile(p: ComplianceProfile): Record<string, string> {
  return compact({
    [GPSR_KEYS.manufacturerName]: p.manufacturerName,
    [GPSR_KEYS.manufacturerAddress]: p.manufacturerAddress,
    [GPSR_KEYS.manufacturerEmail]: p.manufacturerEmail,
    [GPSR_KEYS.manufacturerCountry]: p.manufacturerCountry,
  })
}

/** Attribute rows for the EU responsible person block. */
export function euRepAttributesFromProfile(p: ComplianceProfile): Record<string, string> {
  return compact({
    [GPSR_KEYS.euRepName]: p.euRepName,
    [GPSR_KEYS.euRepAddress]: p.euRepAddress,
    [GPSR_KEYS.euRepEmail]: p.euRepEmail,
  })
}

export const hasManufacturerBlock = (p: ComplianceProfile) =>
  Boolean(p.manufacturerName || p.manufacturerAddress || p.manufacturerEmail || p.manufacturerCountry)
export const hasEuRepBlock = (p: ComplianceProfile) => Boolean(p.euRepName || p.euRepAddress || p.euRepEmail)

function compact(rec: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(rec).filter(([, v]) => v.trim().length > 0))
}
