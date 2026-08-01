/** Response headers applied site-wide (see `next.config.ts` `headers()`). */
export const AFFISELL_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  /** Clickjacking — full CSP script-src deferred (Next + Stripe friction). */
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  /** Allow Stripe Checkout / OAuth popups while isolating opener. */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
]

export function hstsHeader(): { key: string; value: string } | null {
  if (process.env.NODE_ENV !== "production") return null
  return {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  }
}

export function buildEmbedSecurityHeaders(): ReadonlyArray<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: "frame-ancestors *; object-src 'none'; base-uri 'self'" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  ]
}

export function buildSecurityHeaders(): ReadonlyArray<{ key: string; value: string }> {
  const hsts = hstsHeader()
  return hsts ? [...AFFISELL_SECURITY_HEADERS, hsts] : [...AFFISELL_SECURITY_HEADERS]
}
