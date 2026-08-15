/** Client-safe supplier ↔ affiliate identity veil constants. */

export const SUPPLIER_PARTNER_IDENTITY_FORBIDDEN_KEYS = [
  "resellerStoreSlug",
  "boutiquePath",
  "boutiqueUrl",
  "affiliateSlug",
  "affiliateStoreSlug",
  "affiliateBoutiqueSlug",
  "shopSlug",
] as const

export type SupplierPartnerIdentityForbiddenKey =
  (typeof SUPPLIER_PARTNER_IDENTITY_FORBIDDEN_KEYS)[number]
