import { pathnameWithoutLocale } from "@/lib/locale-path"

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
  "api",
  "auth",
  "blog",
  "cart",
  "careers",
  "cgv",
  "cgu",
  "checkout",
  "contact",
  "creators",
  "dashboard",
  "demo",
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
