import type { MerchantRole } from "@/lib/legal/consent"
import {
  CURRENT_TERMS_VERSION,
  isRoleTermsVersionCurrent,
} from "@/lib/legal-versions"

export function roleTermsHrefForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "/conditions-fournisseur"
  if (role === "AFFILIATE") return "/conditions-affilie"
  return "/cgu"
}

export function roleTermsLabelForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "CGS"
  if (role === "AFFILIATE") return "CGA"
  return "CGU"
}

export function roleTermsVersionKey(role: MerchantRole): string {
  if (role === "SUPPLIER") return CURRENT_TERMS_VERSION.SUPPLIER
  if (role === "AFFILIATE") return CURRENT_TERMS_VERSION.AFFILIATE
  return ""
}

export function hasRoleTermsAccepted(
  termsAcceptedVersion: string | null | undefined,
  role: MerchantRole
): boolean {
  if (role !== "SUPPLIER" && role !== "AFFILIATE") return false
  if (isRoleTermsVersionCurrent(role, termsAcceptedVersion)) return true
  const legacySlug = role === "SUPPLIER" ? "terms-supplier" : "terms-affiliate"
  return Boolean(termsAcceptedVersion?.includes(legacySlug))
}

export function buildRoleTermsPayload(role: "SUPPLIER" | "AFFILIATE") {
  const now = new Date()
  return {
    termsAcceptedAt: now,
    termsAcceptedVersion: CURRENT_TERMS_VERSION[role],
  }
}
