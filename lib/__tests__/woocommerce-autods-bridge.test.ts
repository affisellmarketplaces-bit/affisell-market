import { describe, expect, it } from "vitest"

import { parseWooCommerceAuthParams } from "@/lib/woocommerce-compat/auth-params"
import { generateWooCommerceApiKeys } from "@/lib/woocommerce-compat/generate-keys"

describe("woocommerce autods bridge", () => {
  it("parses wc-auth query params", () => {
    const parsed = parseWooCommerceAuthParams(
      new URLSearchParams({
        app_name: "AutoDS",
        scope: "read_write",
        user_id: "bc5b25cf-bbc5-4b84-96bd-bc0000000000",
        return_url: "https://platform.autods.com/onboarding/callback",
        callback_url: "https://platform.autods.com/api/woocommerce/callback",
      })
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.params.app_name).toBe("AutoDS")
  })

  it("rejects non-https callback_url", () => {
    const parsed = parseWooCommerceAuthParams(
      new URLSearchParams({
        app_name: "AutoDS",
        scope: "read_write",
        user_id: "1",
        return_url: "https://platform.autods.com/return",
        callback_url: "http://insecure.example/callback",
      })
    )
    expect(parsed.ok).toBe(false)
  })

  it("generates ck_/cs_ keys", () => {
    const keys = generateWooCommerceApiKeys()
    expect(keys.consumerKey.startsWith("ck_")).toBe(true)
    expect(keys.consumerSecret.startsWith("cs_")).toBe(true)
  })
})
