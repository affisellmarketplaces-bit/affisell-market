import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/auto-order/redis", () => ({ getRedisUrl: () => null }))

import {
  consumeWinnersQuota,
  winnersQuotaCapForPlan,
  WINNERS_QUOTA_DEFAULT,
  WINNERS_QUOTA_LANCEUR,
} from "@/lib/growth/winners-quota.server"

describe("Growth winners weekly quota", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("caps non-Lanceur users at 10/week, Lanceur at 50/week", () => {
    expect(winnersQuotaCapForPlan("none")).toBe(WINNERS_QUOTA_DEFAULT)
    expect(winnersQuotaCapForPlan("dominator")).toBe(WINNERS_QUOTA_DEFAULT)
    expect(winnersQuotaCapForPlan(null)).toBe(WINNERS_QUOTA_DEFAULT)
    expect(winnersQuotaCapForPlan("lanceur")).toBe(WINNERS_QUOTA_LANCEUR)
  })

  it("allows the full request when under cap", async () => {
    const result = await consumeWinnersQuota("u-fresh-1", 8, 10)
    expect(result.allowed).toBe(8)
    expect(result.remaining).toBe(2)
  })

  it("truncates (never hard-blocks) once the request would exceed the cap", async () => {
    const userId = "u-truncate-1"
    const first = await consumeWinnersQuota(userId, 8, 10)
    expect(first.allowed).toBe(8)
    // Second call this week only has 2 left, even though 8 more are "available" from the source.
    const second = await consumeWinnersQuota(userId, 8, 10)
    expect(second.allowed).toBe(2)
    expect(second.remaining).toBe(0)
  })

  it("returns 0 allowed once the week's cap is fully consumed", async () => {
    const userId = "u-exhausted-1"
    await consumeWinnersQuota(userId, 10, 10)
    const result = await consumeWinnersQuota(userId, 5, 10)
    expect(result.allowed).toBe(0)
    expect(result.remaining).toBe(0)
  })

  it("is bypassed entirely when GROWTH_WINNERS_QUOTA_PAUSED is set", async () => {
    vi.stubEnv("GROWTH_WINNERS_QUOTA_PAUSED", "1")
    const result = await consumeWinnersQuota("u-paused-1", 500, 10)
    expect(result.allowed).toBe(500)
  })

  it("tracks different users independently", async () => {
    const a = await consumeWinnersQuota("u-indep-a", 10, 10)
    const b = await consumeWinnersQuota("u-indep-b", 10, 10)
    expect(a.allowed).toBe(10)
    expect(b.allowed).toBe(10)
  })
})
