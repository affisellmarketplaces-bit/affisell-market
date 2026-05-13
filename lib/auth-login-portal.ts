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
  if (lower.includes("/dashboard/supplier") || lower.includes("/signup/supplier")) return "SUPPLIER"
  if (
    lower.includes("/dashboard/affiliate") ||
    lower.includes("/signup/affiliate") ||
    lower.startsWith("/affiliate/")
  ) {
    return "AFFILIATE"
  }
  return null
}

export function isValidEmailIdentifier(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return t.includes("@") && t.length >= 3 && !t.startsWith("@") && !t.endsWith("@")
}
