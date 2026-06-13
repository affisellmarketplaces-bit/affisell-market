import { appBaseUrl } from "@/lib/app-base-url"
import { normalizeRequestHost } from "@/lib/custom-domain-host"
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
}

export type StorePublicUrls = {
  /** Best URL for ads / sharing (custom domain > subdomain > platform path). */
  primaryUrl: string
  subdomainUrl: string
  platformPathUrl: string
  customDomainUrl: string | null
}

export function storePathOnPlatform(input: StorePublicUrlInput): string {
  const enc = encodeURIComponent(input.slug)
  return input.role === "SUPPLIER" ? `/store/supplier/${enc}` : `/shops/${enc}`
}

function protocolFromAppBase(): "http" | "https" {
  return appBaseUrl().startsWith("https") ? "https" : "http"
}

export function storeSubdomainPublicUrl(slug: string): string {
  return `${protocolFromAppBase()}://${storeSubdomainHost(slug)}`
}

function useSubdomainAsPrimaryClickable(): boolean {
  if (!isStoreSubdomainEnabled()) return false
  if (process.env.NODE_ENV === "development") {
    return process.env.AFFISELL_STORE_USE_SUBDOMAIN_IN_DEV === "1"
  }
  return true
}

export function resolveStorePublicUrls(input: StorePublicUrlInput): StorePublicUrls {
  const base = appBaseUrl()
  const platformPathUrl = `${base}${storePathOnPlatform(input)}`
  const subdomainUrl = storeSubdomainPublicUrl(input.slug)

  const domain = normalizeRequestHost(input.customDomain ?? undefined)
  const customDomainUrl = domain && input.domainVerified ? `https://${domain}` : null

  const primaryUrl =
    customDomainUrl ??
    (useSubdomainAsPrimaryClickable() ? subdomainUrl : platformPathUrl)

  return {
    primaryUrl,
    subdomainUrl,
    platformPathUrl,
    customDomainUrl,
  }
}

/** Canonical public URL for a verified custom domain or auto subdomain. */
export function storePublicUrl(input: StorePublicUrlInput): string {
  return resolveStorePublicUrls(input).primaryUrl
}

export function storeHostSuffixForUi(): string {
  return storeHostSuffix()
}
