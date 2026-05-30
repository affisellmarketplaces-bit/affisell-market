import { inferLoginPortal, sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"

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
