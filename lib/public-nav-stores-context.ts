/** Buyer vs reseller wording for the public `/shops` nav pill. */

export type PublicStoresNavRole = string | null | undefined

/**
 * Reseller-facing nav when the visitor is an affiliate/reseller
 * or already on a B2B acquisition path (after “Are you a reseller?”).
 * Guests and customers stay on trust copy.
 */
export function isResellerStoresNavContext(
  role: PublicStoresNavRole,
  pathname: string | null | undefined
): boolean {
  const normalized = (role ?? "").trim().toUpperCase()
  if (normalized === "AFFILIATE" || normalized === "RESELLER") return true

  const path = pathname ?? ""
  if (path.startsWith("/dashboard/reseller") || path.startsWith("/dashboard/affiliate")) {
    return true
  }
  if (path === "/become-reseller" || path.startsWith("/become-reseller/")) return true
  if (path.startsWith("/signup/affiliate") || path.startsWith("/onboarding/affiliate")) {
    return true
  }
  if (path.startsWith("/sell/affiliate-program")) return true

  return false
}
