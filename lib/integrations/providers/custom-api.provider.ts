import { IntegrationProvider } from "@prisma/client"

import type { IntegrationProviderAdapter } from "@/lib/integrations/types"

/** Custom inbound API provider stub. */
export class CustomApiIntegrationProvider implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.CUSTOM_API

  async authenticate(): Promise<{ error: string }> {
    return { error: "CUSTOM_API_OAUTH_NOT_SUPPORTED" }
  }

  async fetchProducts(): Promise<never> {
    throw new Error("Custom API full sync not implemented — use inbound webhook")
  }
}
