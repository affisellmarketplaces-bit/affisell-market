import { devLocalhostOrigin } from "@/lib/dev-localhost-url"
import { isLocalhostUrl } from "@/lib/localhost-host"
import { canonicalPlatformOrigin } from "@/lib/platform-canonical-url"

export { isLocalhostHost, isLocalhostUrl } from "@/lib/localhost-host"

function isProductionDeploy(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "production") return true
  if (vercelEnv === "preview" || vercelEnv === "development") return false
  return process.env.NODE_ENV === "production"
}

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "")
  if (trimmed.startsWith("http")) return trimmed
  return `https://${trimmed}`
}

/** Buyer-facing origin — never localhost on production (emails, absolute links, webhooks). */
export function resolvePublicAppUrl(): string {
  const candidates = [
    process.env.AFFISELL_PLATFORM_ORIGIN?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.APP_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.NEXT_PUBLIC_BASE_URL?.trim(),
  ].filter(Boolean) as string[]

  for (const raw of candidates) {
    if (isProductionDeploy() && isLocalhostUrl(raw)) continue
    return normalizeOrigin(raw)
  }

  if (!isProductionDeploy()) {
    const vercel = process.env.VERCEL_URL?.trim()
    if (vercel && !isLocalhostUrl(vercel)) return normalizeOrigin(vercel)
    return devLocalhostOrigin()
  }

  return canonicalPlatformOrigin()
}

/** Build an absolute HTTPS URL on the public platform (path may start with /). */
export function publicAbsoluteUrl(pathOrUrl: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return resolvePublicAppUrl()
  if (/^https?:\/\//i.test(raw)) {
    return rewriteLocalhostToPublic(raw)
  }
  const base = resolvePublicAppUrl()
  const path = raw.startsWith("/") ? raw : `/${raw}`
  return `${base}${path}`
}

/** Replace localhost origins with the canonical public origin (keep path + query). */
export function rewriteLocalhostToPublic(raw: string): string {
  if (!isLocalhostUrl(raw)) {
    const trimmed = raw.trim()
    if (trimmed.startsWith("http://") && isProductionDeploy()) {
      return trimmed.replace(/^http:\/\//i, "https://")
    }
    return trimmed
  }
  try {
    const u = new URL(raw)
    const target = new URL(u.pathname + u.search + u.hash, resolvePublicAppUrl())
    return target.href
  } catch {
    return resolvePublicAppUrl()
  }
}

/** Sanitize a single buyer-facing link (emails, webhooks). */
export function sanitizePublicLink(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return resolvePublicAppUrl()
  if (/^https?:\/\//i.test(trimmed)) return rewriteLocalhostToPublic(trimmed)
  return publicAbsoluteUrl(trimmed)
}
