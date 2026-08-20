/** Normalize Woo store URL → origin with protocol (no trailing slash). */
export function normalizeWooShopDomain(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let withProtocol = trimmed
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`
  }

  try {
    const url = new URL(withProtocol)
    if (!isAllowedWooShopProtocol(url)) return null
    return url.origin
  } catch {
    return null
  }
}

/** HTTPS in prod; http allowed for localhost / tastewp dev stores. */
export function isAllowedWooShopProtocol(url: URL): boolean {
  if (url.protocol === "https:") return true
  if (url.protocol === "http:") {
    const host = url.hostname.toLowerCase()
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".tastewp.com") ||
      host.endsWith(".local")
    )
  }
  return false
}
