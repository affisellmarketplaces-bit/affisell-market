export type LegalDocMeta = {
  slug: string
  title: string
  description: string
  lastUpdated: string
  order: number
}

export const LEGAL_SLUGS = [
  "terms-of-service",
  "terms-supplier",
  "terms-affiliate",
  "privacy-policy",
  "refund-policy",
  "cookies-policy",
  "mentions",
] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug)
}
