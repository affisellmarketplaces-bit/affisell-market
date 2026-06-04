import { CGA_VERSION } from "@/lib/legal/cga"
import { CGS_VERSION } from "@/lib/legal/cgs"
import type { MerchantRole } from "@/lib/legal/consent"

export function roleTermsHrefForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "/conditions-fournisseur"
  if (role === "AFFILIATE") return "/conditions-affilie"
  return "/cgu"
}

export function roleTermsLabelForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "CGA"
  if (role === "AFFILIATE") return "CGS"
  return "CGU"
}

export function roleTermsVersionKey(role: MerchantRole): string {
  return role === "SUPPLIER" ? `cga:${CGA_VERSION}` : `cgs:${CGS_VERSION}`
}

export function hasRoleTermsAccepted(
  termsAcceptedVersion: string | null | undefined,
  role: MerchantRole
): boolean {
  if (!termsAcceptedVersion?.trim()) return false
  const expected = roleTermsVersionKey(role)
  if (termsAcceptedVersion === expected) return true
  const legacySlug = role === "SUPPLIER" ? "terms-supplier" : "terms-affiliate"
  return termsAcceptedVersion.includes(legacySlug) || termsAcceptedVersion.includes(expected.split(":")[0]!)
}

export function buildRoleTermsPayload(role: "SUPPLIER" | "AFFILIATE") {
  const now = new Date()
  return {
    termsAcceptedAt: now,
    termsAcceptedVersion: roleTermsVersionKey(role),
  }
}
