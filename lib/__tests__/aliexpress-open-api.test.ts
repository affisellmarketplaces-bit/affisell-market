import { describe, expect, it } from "vitest"

import {
  getAliExpressTimestamp,
  signAliExpressParams,
  signAliExpressParamsHmacSha256,
} from "@/lib/aliexpress-open-api"

describe("signAliExpressParams", () => {
  it("builds Taobao MD5 sign (sorted keys, secret wrapped)", () => {
    const sign = signAliExpressParams(
      {
        method: "aliexpress.system.time.get",
        app_key: "test_app_key",
        sign_method: "md5",
        timestamp: "2026-05-20 12:00:00",
        format: "json",
        v: "2.0",
      },
      "test_secret"
    )
    expect(sign).toMatch(/^[A-F0-9]{32}$/)
    expect(sign).toBe(
      signAliExpressParams(
        {
          v: "2.0",
          timestamp: "2026-05-20 12:00:00",
          sign_method: "md5",
          method: "aliexpress.system.time.get",
          format: "json",
          app_key: "test_app_key",
        },
        "test_secret"
      )
    )
  })

  it("ignores sign key when computing signature", () => {
    const base = {
      method: "aliexpress.system.time.get",
      app_key: "k",
      sign_method: "md5",
      timestamp: "2026-05-20 12:00:00",
      format: "json",
      v: "2.0",
    }
    const a = signAliExpressParams({ ...base, sign: "WRONG" }, "sec")
    const b = signAliExpressParams(base, "sec")
    expect(a).toBe(b)
  })

  it("HMAC-SHA256 wraps the same secret+kv+secret payload", () => {
    const params = {
      app_key: "534690",
      code: "abc",
      sign_method: "sha256",
      timestamp: "2026-08-02 14:20:30",
    }
    const sign = signAliExpressParamsHmacSha256(params, "secret")
    expect(sign).toMatch(/^[A-F0-9]{64}$/)
    expect(sign).toBe(signAliExpressParamsHmacSha256({ ...params, sign: "x" }, "secret"))
  })
})

describe("getAliExpressTimestamp", () => {
  it("formats Asia/Shanghai as YYYY-MM-DD HH:mm:ss", () => {
    // 2026-08-02 06:20:30 UTC → 14:20:30 in Shanghai (UTC+8)
    const ts = getAliExpressTimestamp(new Date("2026-08-02T06:20:30.000Z"))
    expect(ts).toBe("2026-08-02 14:20:30")
  })

  it("matches AliExpress pattern", () => {
    expect(getAliExpressTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
