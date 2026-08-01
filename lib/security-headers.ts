/** Response headers applied site-wide (see `next.config.ts` `headers()`). */

/** Enforcing CSP — clickjacking + object/base only (full script-src is Report-Only). */
export const AFFISELL_CSP_ENFORCE =
  "frame-ancestors 'self'; object-src 'none'; base-uri 'self'"

/**
 * Report-Only CSP — observe Next + Stripe without breaking checkout.
 * Reports land on `/api/csp-report` when browsers support report-uri / report-to.
 */
export const AFFISELL_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://*.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: https://api.stripe.com https://*.stripe.com https://*.sentry.io https://*.vercel-insights.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ")

export const AFFISELL_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Content-Security-Policy", value: AFFISELL_CSP_ENFORCE },
  { key: "Content-Security-Policy-Report-Only", value: AFFISELL_CSP_REPORT_ONLY },
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
