import { describe, expect, it } from "vitest"

import {
  encodeAliExpressQuery,
  getAliExpressTimestampMs,
  signAliExpressTopHmacSha256,
} from "@/lib/aliexpress-open-api"
import { ALIEXPRESS_DS_SYNC_HOSTS } from "@/lib/aliexpress-ds-sync"

describe("aliexpress-ds-sync", () => {
  it("prefers api-sg host first for DS calls", () => {
    expect(ALIEXPRESS_DS_SYNC_HOSTS[0]).toBe("https://api-sg.aliexpress.com/sync")
  })

  it("builds sha256 sync query with epoch-ms timestamp", () => {
    const params = {
      method: "aliexpress.ds.product.get",
      app_key: "534690",
      session: "token",
      access_token: "token",
      sign_method: "sha256",
      timestamp: getAliExpressTimestampMs(new Date("2026-08-02T06:20:30.000Z")),
      format: "json",
      v: "2.0",
      simplify: "true",
      product_id: "1005012130287204",
      target_currency: "EUR",
      ship_to_country: "FR",
      target_language: "FR",
    }
    params.sign = signAliExpressTopHmacSha256(params, "secret")
    const q = encodeAliExpressQuery(params)
    expect(q).toContain("sign_method=sha256")
    expect(q).toContain("product_id=1005012130287204")
    expect(params.sign).toMatch(/^[A-F0-9]{64}$/)
  })
})
