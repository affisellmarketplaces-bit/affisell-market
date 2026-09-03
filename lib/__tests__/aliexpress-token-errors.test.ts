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
      "@/lib/aliexpress-token-errors"
    )
    expect(
      extractAliExpressApiErrorFromWarnings([
        "API AliExpress : The specified access token is invalid or expired — tentative scraping.",
      ])
    ).toContain("invalid or expired")
  })

  it("resolves token error when scrape masked API failure", async () => {
    const { resolveDropForgeApiError } = await import("@/lib/aliexpress-token-errors")
    expect(
      resolveDropForgeApiError({
        agentOk: false,
        agentError: "Import AliExpress impossible depuis le serveur pour cette URL.",
        agentApiError: "The specified access token is invalid or expired",
        warnings: [],
      })
    ).toContain("invalid or expired")
  })
})
