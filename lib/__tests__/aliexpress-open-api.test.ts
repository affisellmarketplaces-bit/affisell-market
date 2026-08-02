import { describe, expect, it } from "vitest"

import {
  encodeAliExpressQuery,
  getAliExpressTimestamp,
  getAliExpressTimestampMs,
  signAliExpressIopHmacSha256,
  signAliExpressParams,
  signAliExpressParamsHmacSha256,
  signAliExpressTopHmacSha256,
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
  })

  it("TOP Open Platform HMAC signs sorted kv without secret wrap (ae_sdk)", () => {
    const params = {
      app_key: "534690",
      method: "aliexpress.ds.order.create",
      sign_method: "sha256",
      timestamp: "1712345678901",
    }
    const a = signAliExpressTopHmacSha256(params, "secret")
    const b = signAliExpressTopHmacSha256(params, "secret")
    expect(a).toBe(b)
    expect(a).toMatch(/^[A-F0-9]{64}$/)
    expect(a).not.toBe(signAliExpressParamsHmacSha256(params, "secret"))
  })

  it("IOP HMAC prefixes api path", () => {
    const params = {
      app_key: "534690",
      code: "abc",
      sign_method: "sha256",
      timestamp: "1712345678901",
    }
    const a = signAliExpressIopHmacSha256("/auth/token/create", params, "secret")
    const b = signAliExpressIopHmacSha256("/auth/token/create", params, "secret")
    expect(a).toBe(b)
    expect(a).toMatch(/^[A-F0-9]{64}$/)
    expect(a).not.toBe(signAliExpressParamsHmacSha256(params, "secret"))
  })
})

describe("getAliExpressTimestamp", () => {
  it("formats Asia/Shanghai as YYYY-MM-DD HH:mm:ss via UTC+8 math", () => {
    const ts = getAliExpressTimestamp(new Date("2026-08-02T06:20:30.000Z"))
    expect(ts).toBe("2026-08-02 14:20:30")
  })

  it("matches AliExpress pattern", () => {
    expect(getAliExpressTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it("exposes epoch ms for IOP callers", () => {
    const d = new Date("2026-08-02T06:20:30.000Z")
    expect(getAliExpressTimestampMs(d)).toBe(String(d.getTime()))
  })
})

describe("encodeAliExpressQuery", () => {
  it("encodes spaces as %20 not +", () => {
    const q = encodeAliExpressQuery({
      timestamp: "2026-08-02 14:20:30",
      app_key: "534690",
    })
    expect(q).toContain("timestamp=2026-08-02%2014%3A20%3A30")
    expect(q).not.toContain("+")
  })
})
