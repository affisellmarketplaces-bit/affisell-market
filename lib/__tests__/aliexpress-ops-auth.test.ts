import { describe, expect, it, vi, afterEach } from "vitest"

import { authorizeAliExpressOps, extractBodySecret, stripBodySecret } from "@/lib/aliexpress-ops-auth"

describe("aliexpress-ops-auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("extracts and strips body secret", () => {
    const body = { secret: "abc", supplierProductId: "1" }
    expect(extractBodySecret(body)).toBe("abc")
    expect(stripBodySecret(body)).toEqual({ supplierProductId: "1" })
  })

  it("accepts ?secret= when CRON_SECRET matches", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value-32chars-xxxxxx")
    vi.stubEnv("VERCEL_ENV", "production")
    const req = new Request(
      "https://example.com/api/aliexpress/order/create?secret=test-secret-value-32chars-xxxxxx",
      { method: "POST" }
    )
    expect(authorizeAliExpressOps(req)).toBeNull()
  })

  it("rejects missing auth in production", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value-32chars-xxxxxx")
    vi.stubEnv("VERCEL_ENV", "production")
    const req = new Request("https://example.com/api/aliexpress/order/create", {
      method: "POST",
    })
    const res = authorizeAliExpressOps(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(401)
  })

  it("accepts JSON body secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value-32chars-xxxxxx")
    vi.stubEnv("VERCEL_ENV", "production")
    const req = new Request("https://example.com/api/aliexpress/order/create", {
      method: "POST",
    })
    expect(
      authorizeAliExpressOps(req, { bodySecret: "test-secret-value-32chars-xxxxxx" })
    ).toBeNull()
  })
})
