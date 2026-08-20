import { IntegrationProvider } from "@prisma/client"

import type { IntegrationProviderAdapter } from "@/lib/integrations/types"

/** WooCommerce provider stub — same interface as Shopify. */
export class WooIntegrationProvider implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.WOOCOMMERCE

  async authenticate(): Promise<{ error: string }> {
    return { error: "WOO_NOT_IMPLEMENTED" }
  }

  async fetchProducts(): Promise<never> {
    throw new Error("WooCommerce sync not implemented yet")
  }
}
