import type { IntegrationProvider } from "@prisma/client"

import { CustomApiIntegrationProvider } from "@/lib/integrations/providers/custom-api.provider"
import { ShopifyIntegrationProvider } from "@/lib/integrations/providers/shopify.provider"
import { WooIntegrationProvider } from "@/lib/integrations/providers/woo.provider"
import type { IntegrationProviderAdapter, ProviderSlug } from "@/lib/integrations/types"
import { providerEnumFromSlug } from "@/lib/integrations/types"

const shopify = new ShopifyIntegrationProvider()
const woo = new WooIntegrationProvider()
const customApi = new CustomApiIntegrationProvider()

export function getIntegrationProvider(provider: IntegrationProvider): IntegrationProviderAdapter {
  switch (provider) {
    case "SHOPIFY":
      return shopify
    case "WOOCOMMERCE":
      return woo
    case "CUSTOM_API":
      return customApi
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

export function getIntegrationProviderBySlug(slug: string): IntegrationProviderAdapter | null {
  const provider = providerEnumFromSlug(slug)
  if (!provider) return null
  try {
    return getIntegrationProvider(provider)
  } catch {
    return null
  }
}

export function platformFromSlug(slug: ProviderSlug): string {
  if (slug === "custom-api") return "webhook"
  if (slug === "woo") return "woocommerce"
  return slug
}
