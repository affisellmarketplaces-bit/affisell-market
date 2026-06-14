/** Resolve visitor ISO-3166-1 alpha-2 from CDN / edge headers (best-effort). */

const VISITOR_COUNTRY_HEADER_KEYS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "cloudfront-viewer-country",
] as const

const ISO2_RE = /^[A-Z]{2}$/

/** Unknown / reserved codes some CDNs return — treat as no signal. */
const IGNORED_COUNTRY_CODES = new Set(["XX", "T1", "A1", "A2"])

export function normalizeVisitorCountryIso2(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const code = raw.trim().toUpperCase().slice(0, 2)
  if (!ISO2_RE.test(code)) return null
  if (IGNORED_COUNTRY_CODES.has(code)) return null
  return code
}

export function resolveVisitorCountryIso2(headers: Headers): string | null {
  for (const key of VISITOR_COUNTRY_HEADER_KEYS) {
    const code = normalizeVisitorCountryIso2(headers.get(key))
    if (code) return code
  }
  return null
}

export function visitorCountryDisplayName(
  code: string,
  locale: string
): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" })
    return dn.of(code) ?? code
  } catch {
    return code
  }
}
