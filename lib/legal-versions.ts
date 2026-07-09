import { CGA_VERSION } from "@/lib/legal/cga"
import { CGS_VERSION } from "@/lib/legal/cgs"
import { CGU_VERSION } from "@/lib/legal/cgu"

/** Version CGU stockée sur `User.cguVersion`. */
export const CURRENT_CGU_VERSION = CGU_VERSION

export type TermsAcceptanceLogType = "cgu" | "conditions-fournisseur" | "conditions-affilie"

export function termsLogTypeForRole(role: "SUPPLIER" | "AFFILIATE"): TermsAcceptanceLogType {
  return role === "SUPPLIER" ? "conditions-fournisseur" : "conditions-affilie"
}

export function versionForTermsLogType(type: TermsAcceptanceLogType): string {
  if (type === "cgu") return CGU_VERSION
  if (type === "conditions-fournisseur") return CGA_VERSION
  return CGS_VERSION
}
