import { localeFromPathname, pathnameWithoutLocale, URL_LOCALIZED_PATHS } from "@/lib/locale-path"

/**
 * First URL segments that are real app routes, not `app/[locale]` locale codes.
 * Keep in sync when adding top-level routes beside `en` / `fr`.
 */
export const RESERVED_LOCALE_SEGMENTS = new Set([
  "admin",
  "agent",
  "auctions",
  "affiliate",
  "about",
  "accessibilite",
  "api",
  "auth",
  "blog",
  "booking",
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
  "faq",
  "home",
  "how-it-works",
  "invite",
  "legal",
  "mentions-legales",
  "login",
  "luxe",
  "marketplace",
  "onboarding",
  "order-success",
  "partners",
  "press",
  "privacy",
  "product",
  "reaccept-terms",
  "returns",
  "reviews",
  "seller",
  "shipping",
  "shop",
  "shops",
  "signup",
  "store",
  "success",
  "supplier",
  "support",
  "track-order",
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
