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
  "checkout",
  "contact",
  "creators",
  "dashboard",
  "discover",
  "faq",
  "home",
  "invite",
  "legal",
  "login",
  "marketplace",
  "onboarding",
  "order-success",
  "partners",
  "press",
  "product",
  "reviews",
  "seller",
  "shop",
  "shops",
  "signup",
  "store",
  "success",
  "supplier",
  "wishlist",
])

/** True when the first path segment is an app route (not `en` / `fr`). Used by middleware. */
export function isStaticAppPathname(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0]
  return segment != null && RESERVED_LOCALE_SEGMENTS.has(segment)
}
