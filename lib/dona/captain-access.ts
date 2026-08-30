import "server-only"

/** Dashboard / radar referer gate for Dona Capitaine private APIs. */
export function isDonaCaptainReferer(req: Request): boolean {
  const referer = req.headers.get("referer") ?? req.headers.get("referrer") ?? ""
  if (!referer.trim()) return false
  try {
    const path = new URL(referer).pathname
    return path.startsWith("/dashboard") || path.startsWith("/radar")
  } catch {
    return false
  }
}

export const DONA_CAPTAIN_FORBIDDEN = "Dona Privée: accès Capitaine uniquement"
