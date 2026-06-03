import { describe, expect, it } from "vitest"

import { buildMetabaseEmbedUrl } from "@/lib/sentinel/metabase-embed"

describe("buildMetabaseEmbedUrl", () => {
  it("returns null when env is missing", () => {
    expect(buildMetabaseEmbedUrl()).toBeNull()
  })

  it("builds signed embed url when env is set", () => {
    process.env.METABASE_SITE_URL = "https://metabase.example.com"
    process.env.METABASE_SECRET_KEY = "test-secret-key"
    process.env.METABASE_DASHBOARD_ID = "42"

    const url = buildMetabaseEmbedUrl()
    expect(url).toMatch(/^https:\/\/metabase\.example\.com\/embed\/dashboard\/.+#bordered=true&titled=true$/)

    delete process.env.METABASE_SITE_URL
    delete process.env.METABASE_SECRET_KEY
    delete process.env.METABASE_DASHBOARD_ID
  })
})
