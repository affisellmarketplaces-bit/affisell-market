import { describe, expect, it } from "vitest"

import {
  ALIEXPRESS_OAUTH_START_PATH,
  aliExpressOAuthReconnectHint,
  classifyAliExpressTokenError,
  isAliExpressIllegalAccessTokenError,
  shouldOfferAliExpressOAuthReconnect,
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

  it("classifies transient outages as unavailable — no OAuth reconnect CTA", () => {
    expect(classifyAliExpressTokenError("AliExpress token store temporarily unavailable: x")).toBe(
      "unavailable"
    )
    expect(classifyAliExpressTokenError("AliExpress token refresh timed out")).toBe("unavailable")
    expect(classifyAliExpressTokenError("HTTP 503 from gateway")).toBe("unavailable")
    expect(classifyAliExpressTokenError("fetch failed")).toBe("unavailable")
    expect(shouldOfferAliExpressOAuthReconnect("unavailable")).toBe(false)
    expect(aliExpressOAuthReconnectHint("unavailable")).toMatch(/aucune reconnexion nécessaire/i)
  })

  it("still offers OAuth reconnect for real auth failures", () => {
    expect(shouldOfferAliExpressOAuthReconnect("expired_access")).toBe(true)
    expect(shouldOfferAliExpressOAuthReconnect("refresh_failed")).toBe(true)
    expect(shouldOfferAliExpressOAuthReconnect("missing")).toBe(true)
    expect(shouldOfferAliExpressOAuthReconnect(null)).toBe(false)
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
