import type { IntegrationProvider } from "@prisma/client"

import { ShopifyProvider } from "@/lib/supplier-sync/shopify/provider"
import type { SupplierProvider } from "@/lib/supplier-sync/types"

const shopify = new ShopifyProvider()

export function getSupplierProvider(provider: IntegrationProvider): SupplierProvider {
  switch (provider) {
    case "SHOPIFY":
      return shopify
    case "WOOCOMMERCE":
      throw new Error("WooCommerce provider not implemented yet")
    case "CUSTOM_API":
      throw new Error("Custom API provider not implemented yet")
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

export function getSupplierProviderByPlatform(platform: string): SupplierProvider | null {
  const p = platform.trim().toLowerCase()
  if (p === "shopify") return shopify
  return null
}
