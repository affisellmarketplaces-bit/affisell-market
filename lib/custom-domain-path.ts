/** Map paths on a merchant custom domain to internal Affisell storefront routes. */

export type StorefrontRole = "AFFILIATE" | "SUPPLIER"

export function storePublicPrefix(slug: string, role: StorefrontRole): string {
  const enc = encodeURIComponent(slug)
  return role === "SUPPLIER" ? `/store/supplier/${enc}` : `/shops/${enc}`
}

const BLOCKED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/agent",
  "/seller",
  "/api",
  "/auth",
  "/checkout",
  "/marketplace",
] as const

export function isBlockedOnCustomDomain(barePath: string): boolean {
  const bare = barePath || "/"
  return BLOCKED_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`))
}

/**
 * Returns internal pathname for Next.js rewrite, or null if the path should not be rewritten.
 */
export function mapCustomDomainPath(
  barePath: string,
  slug: string,
  role: StorefrontRole
): string | null {
  const bare = barePath || "/"
  if (isBlockedOnCustomDomain(bare)) return null

  const prefix = storePublicPrefix(slug, role)
  if (bare === prefix || bare.startsWith(`${prefix}/`)) return bare

  if (bare === "/" || bare === "") return prefix

  if (role === "AFFILIATE") {
    if (bare === "/cart" || bare.startsWith("/cart/")) {
      return bare
    }
    if (
      bare.startsWith("/product/") ||
      bare === "/account" ||
      bare.startsWith("/account/") ||
      bare === "/login" ||
      bare === "/signup"
    ) {
      return `${prefix}${bare}`
    }
  }

  if (role === "SUPPLIER" && bare.startsWith("/product/")) {
    return `${prefix}${bare}`
  }

  return prefix
}
