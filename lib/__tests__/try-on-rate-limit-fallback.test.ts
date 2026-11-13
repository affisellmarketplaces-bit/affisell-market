import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { enforceTryOnIpRateLimit } from "@/lib/try-on/cloth2body-api.server"

function from(ip: string): Request {
  return new Request("http://localhost/api/try-on", { method: "POST", headers: { "x-forwarded-for": ip } })
}

describe("enforceTryOnIpRateLimit without Upstash", () => {
  beforeEach(() => {
    // "" counts as not configured (the code trims and tests for truthiness)
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("no longer lets everything through: the sixth call in a minute is refused", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await enforceTryOnIpRateLimit(from("198.51.100.10"))).toEqual({ ok: true })
    }

    const sixth = await enforceTryOnIpRateLimit(from("198.51.100.10"))

    expect(sixth.ok).toBe(false)
    if (!sixth.ok) {
      expect(sixth.status).toBe(429)
      expect(sixth.retryAfterSec).toBeGreaterThanOrEqual(1)
      expect(sixth.retryAfterSec).toBeLessThanOrEqual(60)
    }
  })

  it("counts each client separately", async () => {
    for (let i = 0; i < 5; i += 1) await enforceTryOnIpRateLimit(from("198.51.100.20"))

    expect((await enforceTryOnIpRateLimit(from("198.51.100.20"))).ok).toBe(false)
    expect(await enforceTryOnIpRateLimit(from("198.51.100.21"))).toEqual({ ok: true })
  })

  it("says so in the logs, so the missing Upstash setup stays visible", async () => {
    await enforceTryOnIpRateLimit(from("198.51.100.30"))

    expect(console.warn).toHaveBeenCalledWith(
      "[try-on]",
      expect.objectContaining({ result: "rate_limit_in_memory_fallback" })
    )
  })
})
