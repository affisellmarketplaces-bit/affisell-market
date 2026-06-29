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
  { href: "/legal/terms-of-sale", key: "termsOfSale" as const },
  { href: "/legal/privacy-policy", key: "privacy" as const },
  { href: "/legal/legal-notice", key: "legalNotice" as const },
  { href: "/protected-checkout", key: "returns" as const },
  { href: "/support", key: "support" as const },
] as const
