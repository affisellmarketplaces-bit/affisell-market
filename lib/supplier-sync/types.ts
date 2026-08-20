import type { IntegrationProvider, SupplierIntegration } from "@prisma/client"

export type MappedAffisellProduct = {
  externalId: string
  name: string
  description: string
  images: string[]
  basePriceCents: number
  stock: number
  categoryLabel: string
  sourceUrl: string
  supplierSku: string
  contentHash: string
  raw: Record<string, unknown>
}

export type SyncProductResult = {
  externalId: string
  action: "created" | "updated" | "skipped" | "unpublished"
}

export type FullSyncResult = {
  fetched: number
  created: number
  updated: number
  skipped: number
  unpublished: number
}

export type WebhookHandleResult = {
  ok: boolean
  topic?: string
  action?: string
  error?: string
}

export interface SupplierProvider {
  readonly provider: IntegrationProvider

  /** Paginated full catalog pull. */
  fullSync(integration: SupplierIntegrationRow): Promise<FullSyncResult>

  /** Real-time webhook dispatch (idempotent upstream). */
  handleWebhook(args: WebhookContext): Promise<WebhookHandleResult>

  /** Map provider JSON → Affisell normalized row + content hash. */
  mapProduct(raw: Record<string, unknown>, shopDomain: string): MappedAffisellProduct | null
}

export type SupplierIntegrationRow = Pick<
  SupplierIntegration,
  | "id"
  | "userId"
  | "platform"
  | "provider"
  | "name"
  | "enabled"
  | "config"
  | "shopDomain"
  | "accessTokenEncrypted"
  | "refreshTokenEncrypted"
  | "scopes"
  | "status"
  | "webhookId"
>

export type WebhookContext = {
  integration: SupplierIntegrationRow
  topic: string
  shopDomain: string
  payload: Record<string, unknown>
  webhookId: string
}

export type ShopifyCredentials = {
  shopHost: string
  accessToken: string
  apiVersion?: string
}
