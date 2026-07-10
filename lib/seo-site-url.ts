/** Canonical public site origin for sitemap, robots, and JSON-LD. */
import { devLocalhostOrigin } from "@/lib/dev-localhost-url"

export function resolveSiteBaseUrl(): string {
  const baseUrlRaw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    devLocalhostOrigin()
  return baseUrlRaw.replace(/\/$/, "")
}
