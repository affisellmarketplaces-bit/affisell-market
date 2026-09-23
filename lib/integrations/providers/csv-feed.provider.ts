import { IntegrationProvider } from "@prisma/client"

import { mapCsvRowsToCanonical, parseCsvFeedConfig } from "@/lib/integrations/csv-feed-config"
import { fetchCsvFeedRows } from "@/lib/integrations/csv-feed-fetch"
import type { CanonicalProduct, IntegrationProviderAdapter, IntegrationRow } from "@/lib/integrations/types"

/** Pull-based CSV / Google Sheet feed — no OAuth, so `authenticate` is not applicable. */
export class CsvFeedIntegrationProvider implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.CSV_FEED

  async authenticate(): Promise<{ error: string }> {
    return { error: "CSV_FEED_NO_OAUTH" }
  }

  async fetchProducts(integration: IntegrationRow): Promise<CanonicalProduct[]> {
    const config = parseCsvFeedConfig(integration.config)
    if (!config) {
      throw new Error("CSV feed is not configured — reconnect with a feed URL and column mapping")
    }
    const { rows } = await fetchCsvFeedRows(config.feedUrl)
    return mapCsvRowsToCanonical(rows, config.fieldMap)
  }
}
