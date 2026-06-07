import { describe, expect, it } from "vitest"

import { rateLimitResponse, rateLimitResponseAsync } from "@/lib/api-rate-limit"

describe("rateLimitResponse", () => {
  it("allows requests under the limit", () => {
    const k = `test-${Math.random()}`
    expect(rateLimitResponse(k, { limit: 3, windowMs: 60_000, prefix: "t" })).toBeNull()
    expect(rateLimitResponse(k, { limit: 3, windowMs: 60_000, prefix: "t" })).toBeNull()
    expect(rateLimitResponse(k, { limit: 3, windowMs: 60_000, prefix: "t" })).toBeNull()
  })

  it("returns 429 after the limit is exceeded", () => {
    const k = `test-${Math.random()}`
    const opts = { limit: 2, windowMs: 60_000, prefix: "t2" }
    expect(rateLimitResponse(k, opts)).toBeNull()
    expect(rateLimitResponse(k, opts)).toBeNull()
    const res = rateLimitResponse(k, opts)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
  })

  it("rateLimitResponseAsync falls back to in-memory without REDIS_URL", async () => {
    const k = `test-async-${Math.random()}`
    const opts = { limit: 2, windowMs: 60_000, prefix: "t3" }
    expect(await rateLimitResponseAsync(k, opts)).toBeNull()
    expect(await rateLimitResponseAsync(k, opts)).toBeNull()
    const res = await rateLimitResponseAsync(k, opts)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
  })
})
