import { describe, expect, it } from "vitest"

import {
  integrationLiveConnected,
  parseIntegrationSyncSummary,
} from "@/lib/supplier/load-supplier-integrations"

describe("load-supplier-integrations", () => {
  it("parses sync summary stats", () => {
    expect(
      parseIntegrationSyncSummary({ fetched: 10, created: 2, updated: 3, skipped: 5 })
    ).toEqual({
      fetched: 10,
      created: 2,
      updated: 3,
      skipped: 5,
      unpublished: 0,
    })
  })

  it("detects live oauth shopify connection", () => {
    expect(
      integrationLiveConnected({
        platform: "shopify",
        enabled: true,
        status: "CONNECTED",
        config: { oauth: true },
        shopDomain: "demo.myshopify.com",
      })
    ).toBe(true)
  })
})
