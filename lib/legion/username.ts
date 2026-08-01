/** LÉGION username helpers — client-safe. */

export const LEGION_USERNAME_RE = /^[a-z0-9_]{3,20}$/

/** Single-segment paths that must never resolve as @username. */
export const LEGION_RESERVED_USERNAMES = new Set([
  "admin",
  "affiliate",
  "agent",
  "agents",
  "api",
  "auctions",
  "auth",
  "battles",
  "b",
  "become-reseller",
  "become-supplier",
  "blog",
  "booking",
  "brand",
  "browse",
  "cart",
  "careers",
  "checkout",
  "conditions-affilie",
  "conditions-fournisseur",
  "cookies",
  "creators",
  "crm",
  "dashboard",
  "demo",
  "digital",
  "discover",
  "dropforge",
  "e2e",
  "embed",
  "enterprise",
  "faq",
  "fr",
  "help",
  "home",
  "how-it-works",
  "import",
  "intelli",
  "invite",
  "lab",
  "legal",
  "login",
  "luxe",
  "marketplace",
  "offline",
  "onboarding",
  "order-success",
  "orders",
  "partners",
  "press",
  "pricing",
  "product",
  "produits",
  "pulse",
  "r",
  "radar",
  "reviews",
  "sell",
  "seller",
  "shops",
  "signup",
  "store",
  "success",
  "supplier",
  "support",
  "track-order",
  "wishlist",
  "about",
  "cgu",
  "cgv",
  "privacy",
  "terms",
  "u",
  "wc-auth",
  "wp-json",
  "mentions-legales",
  "reaccept-terms",
  "returns",
  "shipping",
  "shop",
  "accessibilite",
  "contact",
  "protected-checkout",
])

export function normalizeLegionUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidLegionUsername(raw: string): boolean {
  const u = normalizeLegionUsername(raw)
  return LEGION_USERNAME_RE.test(u) && !LEGION_RESERVED_USERNAMES.has(u)
}

/** True for `/nelson` or `/u/nelson` — lean chrome (no global Affisell header/footer). */
export function isLegionStorefrontPathname(pathname: string): boolean {
  const bare = (pathname.split("?")[0] ?? "").split("#")[0] ?? ""
  const parts = bare.split("/").filter(Boolean)
  if (parts.length === 2 && parts[0] === "u" && isValidLegionUsername(parts[1] ?? "")) {
    return true
  }
  if (parts.length === 1 && isValidLegionUsername(parts[0] ?? "")) {
    return true
  }
  return false
}
