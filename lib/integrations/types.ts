/**
 * Decoupled supplier integrations — Clone & Own catalog sync.
 * Maps Prisma IntegrationProvider to route slugs and canonical product shapes.
 */

import type { IntegrationProvider, IntegrationStatus, SyncJobStatus } from "@prisma/client"

/** Route slug → Prisma enum */
export type ProviderSlug = "shopify" | "woo" | "custom-api"

export const PROVIDER_SLUG_TO_ENUM: Record<ProviderSlug, IntegrationProvider> = {
  shopify: "SHOPIFY",
  woo: "WOOCOMMERCE",
  "custom-api": "CUSTOM_API",
}

export const PROVIDER_ENUM_TO_SLUG: Record<IntegrationProvider, ProviderSlug> = {
  SHOPIFY: "shopify",
  WOOCOMMERCE: "woo",
  CUSTOM_API: "custom-api",
}

export function providerSlugFromEnum(provider: IntegrationProvider): ProviderSlug {
  return PROVIDER_ENUM_TO_SLUG[provider]
}

export function providerEnumFromSlug(slug: string): IntegrationProvider | null {
  const key = slug.trim().toLowerCase() as ProviderSlug
  return PROVIDER_SLUG_TO_ENUM[key] ?? null
}

export type CanonicalVariant = {
  externalId: string
  sku: string
  title: string
  priceCents: number
  compareAtPriceCents?: number
  inventory: number
}

export type CanonicalImage = {
  url: string
  alt?: string
}

export type CanonicalProduct = {
  externalId: string
  title: string
  descriptionHtml: string
  handle: string
  vendor?: string
  productType?: string
  priceCents: number
  compareAtPriceCents?: number
  inventoryQuantity: number
  images: CanonicalImage[]
  variants: CanonicalVariant[]
  options: Array<{ name: string; values: string[] }>
  raw: Record<string, unknown>
}

export type AuthResult = {
  accessToken: string
  scope?: string
  shopDomain: string
}

export type SyncRunStats = {
  imported: number
  updated: number
  skipped: number
  failed: number
  unpublished: number
  fetched: number
}

export type IntegrationRow = {
  id: string
  userId: string
  provider: IntegrationProvider | null
  platform: string
  shopDomain: string | null
  accessTokenEncrypted: string | null
  refreshTokenEncrypted: string | null
  scopes: string | null
  status: IntegrationStatus
  config: unknown
}

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; error: string }

export interface IntegrationProviderAdapter {
  readonly provider: IntegrationProvider

  authenticate(args: { shop: string; code: string }): Promise<AuthResult | { error: string }>

  fetchProducts(integration: IntegrationRow): Promise<CanonicalProduct[]>

  fetchInventory?(
    integration: IntegrationRow,
    externalProductId: string
  ): Promise<number | null>

  disconnect?(integration: IntegrationRow): Promise<void>

  verifyWebhook?(
    headers: Headers,
    rawBody: string,
    secret: string
  ): WebhookVerifyResult
}

export type SyncJobRecord = {
  id: string
  integrationId: string
  status: SyncJobStatus
  stats: SyncRunStats | null
  error: string | null
  createdAt: Date
  completedAt: Date | null
}

export type DecoupleResult = {
  integrationId: string
  productsDecoupled: number
  status: IntegrationStatus
}
