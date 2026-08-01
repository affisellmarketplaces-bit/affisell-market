/**
 * Outbound URL guards — block SSRF to localhost / private / cloud metadata.
 * Client-safe (no Prisma / Node-only APIs).
 */

export type SafeOutboundUrlResult =
  | { ok: true; url: URL }
  | { ok: false; code: "invalid" | "protocol" | "blocked_host"; error: string }

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default",
  "kubernetes.default.svc",
])

function isIpv4Literal(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return parts
}

/** True when hostname or IPv4 literal must never be fetched by Affisell servers. */
export function isBlockedOutboundHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!host) return true
  if (BLOCKED_HOST_EXACT.has(host)) return true
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true
  }
  if (host === "::1" || host === "[::1]" || host === "0.0.0.0") return true

  const ip = isIpv4Literal(host)
  if (ip) {
    const [a, b] = ip
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true // link-local / AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  }

  return false
}

type AssertOpts = {
  /** Allow http:// in non-production (DropForge paste / local scrapers). Default false. */
  allowHttp?: boolean
}

/**
 * Validate a URL before server-side `fetch`. HTTPS required unless `allowHttp`.
 * Does not perform DNS — blocks obvious private hostnames and IP literals.
 */
export function assertSafeOutboundUrl(raw: string, opts: AssertOpts = {}): SafeOutboundUrlResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, code: "invalid", error: "empty_url" }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, code: "invalid", error: "invalid_url" }
  }

  const proto = url.protocol.toLowerCase()
  if (proto === "https:") {
    /* ok */
  } else if (proto === "http:" && opts.allowHttp) {
    /* ok */
  } else {
    return { ok: false, code: "protocol", error: "url_must_be_https" }
  }

  if (url.username || url.password) {
    return { ok: false, code: "blocked_host", error: "url_credentials_not_allowed" }
  }

  if (isBlockedOutboundHostname(url.hostname)) {
    return { ok: false, code: "blocked_host", error: "url_host_blocked" }
  }

  return { ok: true, url }
}
