/**
 * Single source of truth for the destinations Dona sends people to (pure, client + server safe).
 *
 * Prompts, the offline fallback, the chat linkifier and the sign-up call-to-action card all read from here, so a
 * route can never be right in one place and wrong in another (Dona used to send prospective suppliers to the LOGIN
 * page while calling it "inscription"). `dona-links.test.ts` checks every path below against the app's real routes.
 */

export type DonaRole = "supplier" | "reseller" | "buyer"

/** Account creation, per role. */
export const DONA_SIGNUP_PATH: Record<DonaRole, string> = {
  supplier: "/signup/supplier",
  reseller: "/signup/affiliate",
  buyer: "/signup/customer",
}

/** Sign-in for people who already have an account. */
export const DONA_LOGIN_PATH: Record<DonaRole, string> = {
  supplier: "/login/supplier",
  reseller: "/login/affiliate",
  buyer: "/login/customer",
}

/** Presentation pages that explain the offer before sign-up. */
export const DONA_LANDING_PATH: Record<Exclude<DonaRole, "buyer">, string> = {
  supplier: "/become-supplier",
  reseller: "/become-reseller",
}

/** Other destinations named in Dona's prompts. */
export const DONA_CATALOG_PATH = "/discover"
export const DONA_PULSE_PATH = "/radar"

/** Every path Dona may name (used to verify they all exist). */
export const DONA_REFERENCED_PATHS: readonly string[] = [
  ...Object.values(DONA_SIGNUP_PATH),
  ...Object.values(DONA_LOGIN_PATH),
  ...Object.values(DONA_LANDING_PATH),
  DONA_CATALOG_PATH,
  DONA_PULSE_PATH,
  "/marketplace",
  "/bestsellers",
  "/sell",
]

/**
 * First path segments the chat turns into links when they appear as plain text. Wider than what Dona is told to say:
 * a model that names `/sell/become-supplier` or `/pricing` should still produce a tappable link, not dead text.
 */
export const DONA_LINKABLE_FIRST_SEGMENTS: readonly string[] = [
  "marketplace",
  "product",
  "discover",
  "bestsellers",
  "shops",
  "store",
  "cart",
  "checkout",
  "wishlist",
  "track-order",
  "signup",
  "login",
  "radar",
  "dashboard",
  "sell",
  "become-supplier",
  "become-reseller",
  "pricing",
  "how-it-works",
  "partners",
  "creators",
  "help",
  "contact",
  "support",
  "legal",
]

/** Hosts that mean "this site": an absolute link to them is rewritten to an in-app (client-side) navigation. */
export const DONA_SITE_HOSTS: readonly string[] = ["affisell.com", "www.affisell.com", "affisell-market.vercel.app"]

/**
 * If `href` points at this site (relative path, or absolute / schemeless URL on one of our hosts), return the in-app
 * path (`/signup/supplier?x=1`); otherwise null (a genuine external link).
 */
export function toInternalPath(href: string): string | null {
  const raw = href.trim()
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  const m = /^(?:https?:\/\/)?([a-z0-9.-]+)(\/[^\s]*)?$/i.exec(raw)
  if (!m) return null
  const host = m[1]!.toLowerCase()
  if (!DONA_SITE_HOSTS.includes(host)) return null
  return m[2] && m[2] !== "/" ? m[2] : "/"
}
