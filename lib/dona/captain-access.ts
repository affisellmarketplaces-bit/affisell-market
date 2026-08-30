import "server-only"

/** Dashboard / radar referer or origin gate for Dona Capitaine private APIs. */
export function isDonaCaptainReferer(req: Request): boolean {
  const candidates = [
    req.headers.get("referer"),
    req.headers.get("referrer"),
    req.headers.get("origin"),
  ]

  for (const raw of candidates) {
    if (!raw?.trim()) continue
    try {
      const path = new URL(raw).pathname
      if (path.startsWith("/dashboard") || path.startsWith("/radar")) return true
    } catch {
      // ignore malformed URL
    }
  }

  return false
}

export const DONA_CAPTAIN_FORBIDDEN = "Dona Privée: accès Capitaine uniquement"
