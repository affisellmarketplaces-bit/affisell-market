import type { MerchantRole } from "@/lib/legal/consent"

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

export function buildRoleTermsPayload(_role: "SUPPLIER" | "AFFILIATE") {
  return {
    termsAcceptedAt: new Date(),
  }
}
