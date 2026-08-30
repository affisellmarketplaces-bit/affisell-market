export type MerchantNavRole = "AFFILIATE" | "SUPPLIER" | null

export type SessionNavStatus = "loading" | "authenticated" | "unauthenticated"

/** Dashboard URL → merchant nav role (affiliate vs supplier areas). */
export function roleFromDashboardPath(pathname: string | null): MerchantNavRole {
  if (!pathname) return null
  if (pathname.startsWith("/dashboard/affiliate") || pathname.startsWith("/dashboard/reseller")) {
    return "AFFILIATE"
  }
  if (pathname.startsWith("/dashboard/supplier")) return "SUPPLIER"
  return null
}

/**
 * Resolve header nav for merchant chrome without polling APIs on public `/` during SSR hint flash.
 */
export function resolveMerchantNavRole(input: {
  pathname: string | null
  status: SessionNavStatus
  sessionRole: MerchantNavRole | "CUSTOMER" | null
  hintRole: MerchantNavRole | "CUSTOMER" | null
}): MerchantNavRole {
  const pathRole = roleFromDashboardPath(input.pathname)
  const isDashboard = pathRole != null

  if (isDashboard) {
    if (input.status === "unauthenticated") return null
    if (input.status === "loading") {
      return pathRole ?? normalizeMerchantRole(input.sessionRole) ?? normalizeMerchantRole(input.hintRole)
    }
    return pathRole ?? normalizeMerchantRole(input.sessionRole)
  }

  if (input.status !== "authenticated") return null
  return normalizeMerchantRole(input.sessionRole)
}

function normalizeMerchantRole(role: MerchantNavRole | "CUSTOMER" | null): MerchantNavRole {
  if (role === "AFFILIATE" || role === "SUPPLIER") return role
  return null
}
