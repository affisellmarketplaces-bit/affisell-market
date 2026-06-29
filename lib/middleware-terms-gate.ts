import type { NextRequest } from "next/server"
import type { JWT } from "next-auth/jwt"

import {
  CURRENT_TERMS_VERSION,
  isRoleTermsVersionCurrent,
} from "@/lib/legal-versions"
import { TERMS_OK_COOKIE } from "@/lib/legal/terms-acceptance-cookie"

const REACCEPT_PATH = "/reaccept-terms"

const MERCHANT_TERMS_EXEMPT = new Set([
  REACCEPT_PATH,
  "/supplier/onboarding",
  "/affiliate/onboarding",
  "/login",
  "/login/supplier",
  "/login/affiliate",
  "/login/admin",
  "/login/customer",
  "/signup",
  "/signup/supplier",
  "/signup/affiliate",
  "/sign-up",
  "/cgu",
  "/conditions-fournisseur",
  "/conditions-affilie",
  "/legal/mentions",
  "/privacy",
  "/contact",
])

export function isReacceptTermsPath(bare: string): boolean {
  return bare === REACCEPT_PATH || bare.startsWith(`${REACCEPT_PATH}/`)
}

export function isMerchantTermsExemptPath(bare: string): boolean {
  if (MERCHANT_TERMS_EXEMPT.has(bare)) return true
  if (bare.startsWith("/login/")) return true
  if (bare.startsWith("/signup/")) return true
  if (bare.startsWith("/legal/")) return true
  return false
}

/** Routes bloquées si conditions rôle obsolètes. */
export function isMerchantTermsGatedPath(bare: string): boolean {
  if (bare === "/dashboard/supplier" || bare.startsWith("/dashboard/supplier/")) return true
  if (bare === "/dashboard/affiliate" || bare.startsWith("/dashboard/affiliate/")) return true
  if (bare.startsWith("/supplier/") && bare !== "/supplier/onboarding") return true
  if (bare.startsWith("/affiliate/") && !bare.startsWith("/affiliate/onboarding")) return true
  return false
}

export function merchantTermsGateOk(
  req: NextRequest,
  role: string | undefined,
  token: JWT | null
): boolean {
  if (role !== "SUPPLIER" && role !== "AFFILIATE") return true

  const expected = CURRENT_TERMS_VERSION[role]
  const cookie = req.cookies.get(TERMS_OK_COOKIE)?.value
  if (cookie === expected) return true

  const jwtVersion =
    typeof token?.termsAcceptedVersion === "string" ? token.termsAcceptedVersion : null
  return isRoleTermsVersionCurrent(role, jwtVersion)
}

export function reacceptTermsUrl(req: NextRequest, returnPath: string): URL {
  const u = new URL(REACCEPT_PATH, req.url)
  u.searchParams.set("returnTo", returnPath)
  return u
}
