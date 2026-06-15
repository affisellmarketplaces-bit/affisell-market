import { describe, expect, it } from "vitest"

import {
  buildMetabaseBookingEmbedUrl,
  buildMetabaseEmbedUrl,
  buildMetabaseExpansionBounceEmbedUrl,
  buildMetabaseExpansionEmbedUrl,
} from "@/lib/sentinel/metabase-embed"

describe("booking phase 14", () => {
  it("builds booking metabase embed when METABASE_BOOKING_DASHBOARD_ID is set", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_BOOKING_DASHBOARD_ID = "99"

    const url = buildMetabaseBookingEmbedUrl()
    expect(url).toMatch(/^https:\/\/metabase\.example\.com\/embed\/dashboard\/.+#bordered=true&titled=true$/)

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_BOOKING_DASHBOARD_ID
  })

  it("returns null for booking embed without booking dashboard id", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_DASHBOARD_ID = "1"

    expect(buildMetabaseBookingEmbedUrl()).toBeNull()
    expect(buildMetabaseEmbedUrl()).not.toBeNull()

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_DASHBOARD_ID
  })

  it("builds expansion metabase embed when METABASE_EXPANSION_DASHBOARD_ID is set", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_EXPANSION_DASHBOARD_ID = "42"

    const url = buildMetabaseExpansionEmbedUrl()
    expect(url).toMatch(/^https:\/\/metabase\.example\.com\/embed\/dashboard\/.+#bordered=true&titled=true$/)

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_EXPANSION_DASHBOARD_ID
  })

  it("builds expansion bounce metabase embed when METABASE_EXPANSION_BOUNCE_DASHBOARD_ID is set", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_EXPANSION_BOUNCE_DASHBOARD_ID = "43"

    const url = buildMetabaseExpansionBounceEmbedUrl()
    expect(url).toMatch(/^https:\/\/metabase\.example\.com\/embed\/dashboard\/.+#bordered=true&titled=true$/)

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_EXPANSION_BOUNCE_DASHBOARD_ID
  })
})
