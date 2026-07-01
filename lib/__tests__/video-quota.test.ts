import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"

import { FREE_VIDEO_LIMIT } from "@/lib/video-quota-constants"
import { isQuotaExceeded, quotaSnapshot } from "@/lib/video-quota"

/** Paywall active (founder pause off) for unit tests. */
function withPaywallActive() {
  vi.stubEnv("VIDEO_PAYWALL_PAUSED", "0")
  vi.stubEnv("VIDEO_PAYWALL_DISABLED", "0")
}

describe("video quota", () => {
  beforeEach(() => {
    withPaywallActive()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("allows 3 generations for free users (count 0..2)", () => {
    expect(isQuotaExceeded({ videoCount: 0, isPro: false })).toBe(false)
    expect(isQuotaExceeded({ videoCount: 1, isPro: false })).toBe(false)
    expect(isQuotaExceeded({ videoCount: 2, isPro: false })).toBe(false)
  })

  it("blocks the 4th generation when count reaches limit", () => {
    expect(isQuotaExceeded({ videoCount: FREE_VIDEO_LIMIT, isPro: false })).toBe(true)
    expect(isQuotaExceeded({ videoCount: FREE_VIDEO_LIMIT + 1, isPro: false })).toBe(true)
  })

  it("never blocks Pro users", () => {
    expect(isQuotaExceeded({ videoCount: 99, isPro: true })).toBe(false)
  })

  it("computes remaining for free tier", () => {
    const snap = quotaSnapshot({ videoCount: 2, isPro: false })
    expect(snap.remaining).toBe(1)
    expect(snap.videoLimit).toBe(FREE_VIDEO_LIMIT)
    expect(snap.paywallBypass).toBe(false)
    expect(snap.paywallPaused).toBe(false)
  })

  it("bypasses paywall when founder pause is default (no env)", () => {
    vi.unstubAllEnvs()
    expect(isQuotaExceeded({ videoCount: 99, isPro: false })).toBe(false)
    const snap = quotaSnapshot({ videoCount: 99, isPro: false })
    expect(snap.paywallBypass).toBe(true)
    expect(snap.paywallPaused).toBe(true)
    expect(snap.remaining).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("bypasses paywall when VIDEO_PAYWALL_DISABLED=1 and pause off", () => {
    vi.stubEnv("VIDEO_PAYWALL_PAUSED", "0")
    vi.stubEnv("VIDEO_PAYWALL_DISABLED", "1")
    expect(isQuotaExceeded({ videoCount: 99, isPro: false })).toBe(false)
    const snap = quotaSnapshot({ videoCount: 99, isPro: false })
    expect(snap.paywallBypass).toBe(true)
    expect(snap.remaining).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("re-enables paywall when founder pause is off", () => {
    withPaywallActive()
    expect(isQuotaExceeded({ videoCount: FREE_VIDEO_LIMIT, isPro: false })).toBe(true)
  })
})
