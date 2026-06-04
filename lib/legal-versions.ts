import { CGA_VERSION } from "@/lib/legal/cga"
import { CGS_VERSION } from "@/lib/legal/cgs"
import { CGU_VERSION } from "@/lib/legal/cgu"
import type { MerchantRole } from "@/lib/legal/consent"

/** Version CGU stockée sur `User.cguVersion`. */
export const CURRENT_CGU_VERSION = CGU_VERSION

/** Versions conditions rôle — comparées à `User.termsAcceptedVersion`. */
export const CURRENT_TERMS_VERSION = {
  SUPPLIER: `conditions-fournisseur:${CGA_VERSION}`,
  AFFILIATE: `conditions-affilie:${CGS_VERSION}`,
} as const

export type TermsAcceptanceLogType = "cgu" | "conditions-fournisseur" | "conditions-affilie"

export function termsLogTypeForRole(role: "SUPPLIER" | "AFFILIATE"): TermsAcceptanceLogType {
  return role === "SUPPLIER" ? "conditions-fournisseur" : "conditions-affilie"
}

export function versionForTermsLogType(type: TermsAcceptanceLogType): string {
  if (type === "cgu") return CGU_VERSION
  if (type === "conditions-fournisseur") return CGA_VERSION
  return CGS_VERSION
}

export function isRoleTermsVersionCurrent(
  role: "SUPPLIER" | "AFFILIATE",
  termsAcceptedVersion: string | null | undefined
): boolean {
  if (!termsAcceptedVersion?.trim()) return false
  return termsAcceptedVersion === CURRENT_TERMS_VERSION[role]
}

export function currentTermsVersionForRole(role: MerchantRole): string | null {
  if (role === "SUPPLIER") return CURRENT_TERMS_VERSION.SUPPLIER
  if (role === "AFFILIATE") return CURRENT_TERMS_VERSION.AFFILIATE
  return null
}
