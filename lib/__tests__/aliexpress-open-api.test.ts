import { describe, expect, it } from "vitest"

import { signAliExpressParams } from "@/lib/aliexpress-open-api"

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
    expect(sign).toBe(signAliExpressParams(
      {
        v: "2.0",
        timestamp: "2026-05-20 12:00:00",
        sign_method: "md5",
        method: "aliexpress.system.time.get",
        format: "json",
        app_key: "test_app_key",
      },
      "test_secret"
    ))
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
})
