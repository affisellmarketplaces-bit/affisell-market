import { describe, expect, it } from "vitest"

import { buildExpansionComplaintCsv } from "@/lib/admin/build-expansion-complaint-csv"
import { buildMetabaseExpansionEmailKindEmbedUrl } from "@/lib/sentinel/metabase-embed"

describe("buildExpansionComplaintCsv", () => {
  it("exports complaint rows with BOM", () => {
    const csv = buildExpansionComplaintCsv([
      {
        countryIso2: "jp",
        emailKind: "checkout-launch-followup",
        buyerEmailHash: null,
        complainedAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFcountryIso2;emailKind;buyerEmailHash")).toBe(true)
    expect(csv).toContain("jp;checkout-launch-followup")
  })
})

describe("buildMetabaseExpansionEmailKindEmbedUrl", () => {
  it("builds embed when dashboard id is configured", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_EXPANSION_EMAIL_KIND_DASHBOARD_ID = "55"

    expect(buildMetabaseExpansionEmailKindEmbedUrl()).toMatch(/embed\/dashboard/)

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_EXPANSION_EMAIL_KIND_DASHBOARD_ID
  })
})
