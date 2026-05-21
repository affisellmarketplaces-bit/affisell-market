/**
 * First URL segments that are real app routes, not `app/[locale]` locale codes.
 * Keep in sync when adding top-level routes beside `en` / `fr`.
 */
export const RESERVED_LOCALE_SEGMENTS = new Set([
  "agent",
  "affiliate",
  "api",
  "auth",
  "cart",
  "checkout",
  "contact",
  "creators",
  "dashboard",
  "discover",
  "faq",
  "login",
  "marketplace",
  "onboarding",
  "order-success",
  "partners",
  "product",
  "seller",
  "shop",
  "shops",
  "signup",
  "store",
  "success",
  "supplier",
  "wishlist",
])
