import { inferLoginPortal, sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { pathnameWithoutLocale } from "@/lib/locale-path"

const PRO_PORTAL_PREFIXES = [
  "/dashboard",
  "/admin",
  "/affiliate",
  "/supplier",
  "/onboarding",
  "/invite",
  "/crm",
  "/login/affiliate",
  "/login/supplier",
  "/login/admin",
  "/signup/affiliate",
  "/signup/supplier",
] as const

const MERCHANT_MARKETING_PREFIXES = ["/creators", "/partners", "/how-it-works"] as const

function matchesPathPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function shopSlugFromBarePath(bare: string): string | null {
  const match = bare.match(/^\/shops\/([^/]+)/)
  const slug = match?.[1]
  if (!slug || slug === "browse") return null
  return decodeURIComponent(slug)
}

export function shopBuyerLoginPath(shopSlug: string, callbackUrl?: string | null): string {
  const fallback = `/shops/${shopSlug}`
  const safe = sanitizeInternalCallbackUrl(callbackUrl ?? fallback) ?? fallback
  return `/shops/${shopSlug}/login?callbackUrl=${encodeURIComponent(safe)}`
}

function defaultBuyerSignInCallback(bare: string): string {
  if (bare === "/" || bare === "/marketplace") return MARKETPLACE_BUYER_ORDERS_PATH
  return bare
}

/** Header / public CTA — buyer shop login, customer portal, or pro selector by path. */
export function resolvePublicSignInHref(pathname: string, callbackUrl?: string | null): string {
  const bare = pathnameWithoutLocale(pathname)
  const callback = sanitizeInternalCallbackUrl(callbackUrl ?? bare)

  if (bare.startsWith("/login/affiliate")) return loginAffiliatePath(callback)
  if (bare.startsWith("/login/supplier")) return loginSupplierPath(callback)
  if (bare.startsWith("/login/admin")) {
    return callback
      ? `/login/admin?callbackUrl=${encodeURIComponent(callback)}`
      : "/login/admin"
  }
  if (bare === "/login" || bare.startsWith("/login/")) {
    return bare.startsWith("/login/customer") ? loginCustomerPath(callback) : loginSelectorPath(callback)
  }

  if (matchesPathPrefix(bare, PRO_PORTAL_PREFIXES)) {
    if (
      bare.startsWith("/affiliate") ||
      bare.startsWith("/dashboard/affiliate") ||
      bare.startsWith("/login/affiliate") ||
      bare.startsWith("/signup/affiliate") ||
      bare.startsWith("/onboarding/affiliate")
    ) {
      return loginAffiliatePath(callback)
    }
    if (
      bare.startsWith("/supplier") ||
      bare.startsWith("/dashboard/supplier") ||
      bare.startsWith("/login/supplier") ||
      bare.startsWith("/signup/supplier") ||
      bare.startsWith("/onboarding/supplier")
    ) {
      return loginSupplierPath(callback)
    }
    if (bare.startsWith("/admin") || bare.startsWith("/login/admin")) {
      return callback
        ? `/login/admin?callbackUrl=${encodeURIComponent(callback)}`
        : "/login/admin"
    }
    return loginSelectorPath(callback)
  }

  if (matchesPathPrefix(bare, MERCHANT_MARKETING_PREFIXES)) {
    return loginAffiliatePath(callback)
  }

  const shopSlug = shopSlugFromBarePath(bare)
  if (shopSlug) {
    return shopBuyerLoginPath(shopSlug, callbackUrl ?? bare)
  }

  const buyerCallback = sanitizeInternalCallbackUrl(callbackUrl ?? defaultBuyerSignInCallback(bare))
  return loginCustomerPath(buyerCallback ?? MARKETPLACE_BUYER_ORDERS_PATH)
}

export function loginAffiliatePath(callbackUrl?: string | null): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  return safe ? `/login/affiliate?callbackUrl=${encodeURIComponent(safe)}` : "/login/affiliate"
}

export function loginSupplierPath(callbackUrl?: string | null): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  return safe ? `/login/supplier?callbackUrl=${encodeURIComponent(safe)}` : "/login/supplier"
}

export function loginSelectorPath(callbackUrl?: string | null): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  return safe ? `/login?callbackUrl=${encodeURIComponent(safe)}` : "/login"
}

/** Buyer login — marketplace account, order tracking, post-checkout. */
export function loginCustomerPath(callbackUrl?: string | null): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  return safe ? `/login/customer?callbackUrl=${encodeURIComponent(safe)}` : "/login/customer"
}

export function signupCustomerPath(callbackUrl?: string | null): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  return safe ? `/signup/customer?callbackUrl=${encodeURIComponent(safe)}` : "/signup/customer"
}

/** Default post-login target for marketplace buyers. */
export const MARKETPLACE_BUYER_ORDERS_PATH = "/marketplace/account/orders"

/** Safe redirect target after a successful merchant sign-in. */
export function resolvePostLoginRedirect(
  role: string | undefined | null,
  callbackUrl?: string | null
): string {
  const safe = sanitizeInternalCallbackUrl(callbackUrl)
  const portal = inferLoginPortal(safe)

  if (role === "AFFILIATE") {
    if (safe && portal !== "SUPPLIER") return safe
    return "/dashboard/affiliate"
  }
  if (role === "SUPPLIER") {
    if (safe && portal === "SUPPLIER") return safe
    return "/dashboard/supplier"
  }
  if (role === "CUSTOMER") {
    return safe ?? "/shops"
  }
  if (role === "ADMIN") {
    if (safe?.startsWith("/admin")) return safe
    return "/admin/auto-fulfill"
  }
  return safe ?? "/"
}
