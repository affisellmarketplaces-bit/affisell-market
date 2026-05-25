import { appBaseUrl } from "@/lib/app-base-url"
import { normalizeRequestHost } from "@/lib/custom-domain-host"

export type StorePublicUrlInput = {
  slug: string
  customDomain?: string | null
  domainVerified?: boolean
  role: "AFFILIATE" | "SUPPLIER"
}

export function storePathOnPlatform(input: StorePublicUrlInput): string {
  const enc = encodeURIComponent(input.slug)
  return input.role === "SUPPLIER" ? `/store/supplier/${enc}` : `/shops/${enc}`
}

/** Canonical public URL for a verified custom domain or platform path. */
export function storePublicUrl(input: StorePublicUrlInput): string {
  const domain = normalizeRequestHost(input.customDomain ?? undefined)
  if (domain && input.domainVerified) {
    return `https://${domain}`
  }
  const base = appBaseUrl()
  return `${base}${storePathOnPlatform(input)}`
}
