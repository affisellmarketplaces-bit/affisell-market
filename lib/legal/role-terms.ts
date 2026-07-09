import type { MerchantRole } from "@/lib/legal/consent"
import { CURRENT_TERMS_VERSION } from "@/lib/legal-versions"

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

export function buildRoleTermsPayload(role: "SUPPLIER" | "AFFILIATE") {
  const now = new Date()
  return {
    termsAcceptedAt: now,
    termsAcceptedVersion: CURRENT_TERMS_VERSION[role],
  }
}
