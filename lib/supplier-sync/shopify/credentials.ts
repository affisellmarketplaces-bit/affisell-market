import { IntegrationProvider } from "@prisma/client"

import { parseShopifyIntegrationConfig } from "@/lib/supplier-integration-config"
import { encrypt, hasEncryptionKey } from "@/lib/encryption"
import type { ShopifyCredentials, SupplierIntegrationRow } from "@/lib/supplier-sync/types"

export function resolveShopifyCredentials(integration: {
  config: SupplierIntegrationRow["config"] | unknown
  shopDomain: string | null
  accessTokenEncrypted: string | null
}): ShopifyCredentials | null {
  return parseShopifyIntegrationConfig(integration.config, {
    shopDomain: integration.shopDomain,
    accessTokenEncrypted: integration.accessTokenEncrypted,
  })
}

export function encryptShopifyAccessToken(token: string): string {
  if (!hasEncryptionKey()) throw new Error("ENCRYPTION_KEY required for OAuth token storage")
  return encrypt(token)
}

export function integrationProviderShopify(): IntegrationProvider {
  return IntegrationProvider.SHOPIFY
}
