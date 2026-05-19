export type UserRole = "affiliate" | "supplier" | "customer" | null

export type ResolveUserRoleInput = {
  sessionRole?: string | null
  pathname?: string | null
  /** Set by middleware on public storefront routes (`/shops/*`). */
  forcedRole?: UserRole
}

function normalizeSessionRole(role: string | null | undefined): UserRole {
  const r = role?.trim().toLowerCase()
  if (r === "affiliate") return "affiliate"
  if (r === "supplier") return "supplier"
  if (r === "customer") return "customer"
  return null
}

/**
 * Resolves effective UI role from session + URL.
 * `/shops` and `/shops/*` force customer-facing nav (boutique vitrine — RGPD-friendly).
 */
export function resolveUserRole(input: ResolveUserRoleInput): UserRole {
  if (input.forcedRole) return input.forcedRole

  const path = (input.pathname ?? "").split("?")[0] ?? ""

  if (path === "/shops" || path.startsWith("/shops/")) {
    return "customer"
  }

  const sessionRole = normalizeSessionRole(input.sessionRole)
  if (sessionRole) return sessionRole

  return "customer"
}

export function canShowBusinessProductData(role: UserRole): boolean {
  return role === "affiliate" || role === "supplier"
}
