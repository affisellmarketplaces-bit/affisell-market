import { appBaseUrl } from "@/lib/app-base-url"
import { normalizeRequestHost } from "@/lib/custom-domain-host"
import type { StorePublicUrls } from "@/lib/store-public-url-shared"
import {
  isStoreSubdomainEnabled,
  storeHostSuffix,
  storeSubdomainHost,
} from "@/lib/store-host-suffix"

export type StorePublicUrlInput = {
  slug: string
  customDomain?: string | null
  domainVerified?: boolean
  role: "AFFILIATE" | "SUPPLIER"
  /** Vercel SSL for `{slug}.shops.affisell.com` — primary subdomain only when `active`. */
  subdomainVercelStatus?: string | null
}

export type { StorePublicUrls } from "@/lib/store-public-url-shared"

export function storePublicUrlInputFromStore(
  store: {
    slug: string
    customDomain?: string | null
    domainVerified?: boolean
    subdomainVercelStatus?: string | null
  },
  role: "AFFILIATE" | "SUPPLIER"
): StorePublicUrlInput {
  return {
    slug: store.slug,
    customDomain: store.customDomain,
    domainVerified: store.domainVerified,
    subdomainVercelStatus: store.subdomainVercelStatus,
    role,
  }
}

export function storePathOnPlatform(input: StorePublicUrlInput): string {
  const enc = encodeURIComponent(input.slug)
  return input.role === "SUPPLIER" ? `/store/supplier/${enc}` : `/shops/${enc}`
}

export function storeSubdomainPublicUrl(slug: string): string {
  const base = new URL(appBaseUrl())
  base.hostname = storeSubdomainHost(slug)
  base.pathname = ""
  base.search = ""
  base.hash = ""
  return base.origin
}

function appOriginHost(): string {
  try {
    return new URL(appBaseUrl()).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function isSubdomainSslActive(input: StorePublicUrlInput): boolean {
  return input.subdomainVercelStatus === "active"
}

function shouldUseSubdomainAsPrimaryClickable(input: StorePublicUrlInput): boolean {
  if (!isStoreSubdomainEnabled()) return false
  if (process.env.AFFISELL_STORE_SUBDOMAIN_PRIMARY === "0") return false
  if (!isSubdomainSslActive(input)) return false

  const host = appOriginHost()
  // Vercel preview URLs — wildcard *.shops.affisell.com is not attached to this deployment.
  if (host.endsWith(".vercel.app")) return false
  // Local dev — prefer /shops/{slug} on the Next origin (shops.localhost often unroutable).
  if (host === "localhost" || host.endsWith(".localhost")) return false

  return process.env.NODE_ENV === "production" || process.env.AFFISELL_STORE_SUBDOMAIN_PRIMARY === "1"
}

export function resolveStorePublicUrls(input: StorePublicUrlInput): StorePublicUrls {
  const base = appBaseUrl()
  const platformPathUrl = `${base}${storePathOnPlatform(input)}`
  const subdomainUrl = storeSubdomainPublicUrl(input.slug)

  const domain = normalizeRequestHost(input.customDomain ?? undefined)
  const customDomainUrl = domain && input.domainVerified ? `https://${domain}` : null

  const primaryUrl =
    customDomainUrl ??
    (shouldUseSubdomainAsPrimaryClickable(input) ? subdomainUrl : platformPathUrl)

  return {
    primaryUrl,
    subdomainUrl,
    platformPathUrl,
    customDomainUrl,
    subdomainSslActive: isSubdomainSslActive(input),
  }
}

/** Canonical public URL for a verified custom domain or auto subdomain. */
export function storePublicUrl(input: StorePublicUrlInput): string {
  return resolveStorePublicUrls(input).primaryUrl
}

export function storeHostSuffixForUi(): string {
  return storeHostSuffix()
}
