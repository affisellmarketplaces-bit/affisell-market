import { describe, expect, it } from "vitest"

import { FREE_VIDEO_LIMIT } from "@/lib/video-quota-constants"
import { isQuotaExceeded, quotaSnapshot } from "@/lib/video-quota"

describe("video quota", () => {
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
  })
})
