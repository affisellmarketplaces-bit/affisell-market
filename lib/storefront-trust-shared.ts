/** Public storefront trust snapshot — safe for client bundles (no Prisma). */

export type StorefrontTrustSnapshot = {
  storeName: string
  partnerListingCode: string
  merchantVerified: boolean
  legalDisplayName: string | null
  legalStatus: string | null
  countryCode: string | null
  verifiedAt: string | null
}

export const STOREFRONT_TRUST_LEGAL_LINKS = [
  { href: "/legal/cgv", key: "termsOfSale" as const },
  { href: "/legal/confidentialite", key: "privacy" as const },
  { href: "/legal/mentions-legales", key: "legalNotice" as const },
  { href: "/legal/retractation", key: "returns" as const },
  { href: "/support", key: "support" as const },
] as const
