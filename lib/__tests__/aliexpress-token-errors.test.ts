import { describe, expect, it } from "vitest"

import {
  ALIEXPRESS_OAUTH_START_PATH,
  classifyAliExpressTokenError,
  isAliExpressIllegalAccessTokenError,
} from "@/lib/aliexpress-token-errors"

describe("aliexpress-token-errors", () => {
  it("detects IllegalAccessToken from AE ISV payload", () => {
    expect(
      isAliExpressIllegalAccessTokenError("The specified access token is invalid or expired")
    ).toBe(true)
    expect(classifyAliExpressTokenError("IllegalAccessToken: expired")).toBe("expired_access")
  })

  it("exposes oauth start path", () => {
    expect(ALIEXPRESS_OAUTH_START_PATH).toBe("/api/aliexpress/oauth/start")
  })
})

describe("extractAliExpressApiErrorFromWarnings", () => {
  it("pulls API message from agent warnings", async () => {
    const { extractAliExpressApiErrorFromWarnings } = await import(
      "@/lib/dropforge-import-diagnostics"
    )
    expect(
      extractAliExpressApiErrorFromWarnings([
        "API AliExpress : The specified access token is invalid or expired — tentative scraping.",
      ])
    ).toContain("invalid or expired")
  })
})
