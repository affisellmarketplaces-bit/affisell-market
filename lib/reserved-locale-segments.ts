import { localeFromPathname, pathnameWithoutLocale, URL_LOCALIZED_PATHS } from "@/lib/locale-path"

/**
 * First URL segments that are real app routes, not `app/[locale]` locale codes.
 * Keep in sync when adding top-level routes beside `en` / `fr`.
 */
export const RESERVED_LOCALE_SEGMENTS = new Set([
  "admin",
  "agent",
  "agents",
  "auctions",
  "affiliate",
  "about",
  "accessibilite",
  "api",
  "auth",
  "blog",
  "booking",
  "browse",
  "become-reseller",
  "become-supplier",
  "cart",
  "careers",
  "cgv",
  "cgu",
  "conditions-affilie",
  "conditions-fournisseur",
  "cookies",
  "checkout",
  "contact",
  "creators",
  "dashboard",
  "demo",
  "digital",
  "discover",
  "e2e",
  "embed",
  "faq",
  "home",
  "how-it-works",
  "help",
  "invite",
  "legal",
  "mentions-legales",
  "login",
  "luxe",
  "marketplace",
  "onboarding",
  "order-success",
  "orders",
  "partners",
  "press",
  "pricing",
  "privacy",
  "product",
  "produits",
  "protected-checkout",
  "radar",
  "intelli",
  "reaccept-terms",
  "returns",
  "reviews",
  "seller",
  "sell",
  "shipping",
  "shop",
  "shops",
  "signup",
  "store",
  "success",
  "supplier",
  "support",
  "track-order",
  "wc-auth",
  "wp-json",
  "wishlist",
])

/** True when the first path segment is an app route (not `en` / `fr`). Used by middleware. */
export function isStaticAppPathname(pathname: string): boolean {
  const bare = pathnameWithoutLocale(pathname)
  const segment = bare.split("/").filter(Boolean)[0]
  return segment != null && RESERVED_LOCALE_SEGMENTS.has(segment)
}

/** `/fr/login` → `/login` when the route lives outside `app/[locale]`. */
export function staticAppRewriteTarget(pathname: string): string | null {
  if (!isStaticAppPathname(pathname)) return null
  const urlLocale = localeFromPathname(pathname)
  if (!urlLocale) return null
  const bare = pathnameWithoutLocale(pathname)
  if (bare === pathname || URL_LOCALIZED_PATHS.has(bare)) return null
  return bare
}
