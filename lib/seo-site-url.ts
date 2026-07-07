/** Canonical public site origin for sitemap, robots, and JSON-LD. */
export function resolveSiteBaseUrl(): string {
  const baseUrlRaw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001"
  return baseUrlRaw.replace(/\/$/, "")
}
