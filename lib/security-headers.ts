/** Response headers applied site-wide (see `next.config.ts` `headers()`). */
export const AFFISELL_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

export function hstsHeader(): { key: string; value: string } | null {
  if (process.env.NODE_ENV !== "production") return null
  return {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  }
}

export function buildSecurityHeaders(): ReadonlyArray<{ key: string; value: string }> {
  const hsts = hstsHeader()
  return hsts ? [...AFFISELL_SECURITY_HEADERS, hsts] : [...AFFISELL_SECURITY_HEADERS]
}
