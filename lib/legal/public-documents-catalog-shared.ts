export const PUBLIC_LEGAL_CATALOG_SLUGS = [
  "customer",
  "terms-of-sale",
  "supplier",
  "affiliate",
  "privacy",
] as const

export type PublicLegalCatalogSlug = (typeof PUBLIC_LEGAL_CATALOG_SLUGS)[number]

export const PUBLIC_LEGAL_NAMES: Record<PublicLegalCatalogSlug, string> = {
  customer: "CGU",
  "terms-of-sale": "CGV",
  supplier: "CGS",
  affiliate: "CGA",
  privacy: "Politique Confidentialité",
}

export const PUBLIC_LEGAL_READ_PATHS: Record<PublicLegalCatalogSlug, string> = {
  customer: "/cgu",
  "terms-of-sale": "/cgv",
  supplier: "/conditions-fournisseur",
  affiliate: "/conditions-affilie",
  privacy: "/privacy",
}

export type PublicLegalDocumentSummary = {
  slug: PublicLegalCatalogSlug
  name: string
  version: string
  hash: string
  effectiveDate: string
  downloadUrl: string
}
