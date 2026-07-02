export const ENTERPRISE_CATALOG_SIZES = [
  "under_100",
  "100_1000",
  "1000_10000",
  "over_10000",
] as const

export type EnterpriseCatalogSize = (typeof ENTERPRISE_CATALOG_SIZES)[number]

export const ENTERPRISE_CATEGORIES = [
  "fashion",
  "beauty",
  "tech",
  "home",
  "luxury",
  "other",
] as const

export type EnterpriseCategory = (typeof ENTERPRISE_CATEGORIES)[number]

export const ENTERPRISE_COMMERCE_STACKS = [
  "shopify",
  "magento",
  "sap",
  "pim",
  "csv",
  "other",
] as const

export type EnterpriseCommerceStack = (typeof ENTERPRISE_COMMERCE_STACKS)[number]

export type EnterpriseLeadPayload = {
  brandName: string
  website?: string | null
  contactName: string
  contactEmail: string
  catalogSize: EnterpriseCatalogSize
  category: EnterpriseCategory
  commerceStack: EnterpriseCommerceStack
  message?: string | null
  locale?: string | null
}

export function formatEnterpriseLeadNotes(input: EnterpriseLeadPayload): string {
  const lines = [
    "[Enterprise · Grande marque]",
    `Contact: ${input.contactName.trim()} <${input.contactEmail.trim().toLowerCase()}>`,
    `Catalogue: ${input.catalogSize}`,
    `Catégorie: ${input.category}`,
    `Stack: ${input.commerceStack}`,
    input.locale ? `Locale: ${input.locale}` : null,
    input.message?.trim() ? `Message: ${input.message.trim()}` : null,
    `Source: /enterprise`,
    `Submitted: ${new Date().toISOString()}`,
  ]
  return lines.filter(Boolean).join("\n")
}
