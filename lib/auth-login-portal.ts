/**
 * When signing in with email/password toward affiliate or supplier dashboards,
 * only that role may authenticate (see `lib/auth.ts` credentials `authorize`).
 * Neutral URLs (marketplace, /dashboard root, etc.) do not enforce a portal.
 */
export type LoginPortal = "AFFILIATE" | "SUPPLIER"

export function inferLoginPortal(callbackUrl: string | undefined | null): LoginPortal | null {
  if (!callbackUrl || typeof callbackUrl !== "string") return null
  let path = callbackUrl.trim()
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname || path
    }
  } catch {
    /* keep path as-is */
  }
  const q = path.split("?")[0] ?? path
  const lower = q.toLowerCase()
  if (
    lower.includes("/dashboard/supplier") ||
    lower.includes("/signup/supplier") ||
    lower.includes("/auth/signin/supplier")
  ) {
    return "SUPPLIER"
  }
  if (
    lower.includes("/dashboard/affiliate") ||
    lower.includes("/signup/affiliate") ||
    lower.includes("/auth/signin/affiliate") ||
    lower.startsWith("/affiliate/") ||
    lower.startsWith("/marketplace")
  ) {
    return "AFFILIATE"
  }
  return null
}

/** Same-origin relative path only — safe target after sign-in. */
export function sanitizeInternalCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  let path = raw.trim()
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname || path
    }
  } catch {
    return null
  }
  const q = path.split("?")[0] ?? path
  if (!q.startsWith("/") || q.startsWith("//")) return null
  if (q.includes("..")) return null
  return path.split("#")[0] ?? q
}

export function isValidEmailIdentifier(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return t.includes("@") && t.length >= 3 && !t.startsWith("@") && !t.endsWith("@")
}
