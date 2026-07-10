import { describe, expect, it } from "vitest"

import {
  applyXpAward,
  computeProductStreak,
  computeProductXpAward,
  xpToLevel,
} from "@/lib/gamification/xp"

describe("gamification xp", () => {
  it("awards 50 XP on first product", () => {
    expect(computeProductXpAward({ isFirstProduct: true })).toBe(50)
    expect(computeProductXpAward({ isFirstProduct: false })).toBe(10)
  })

  it("computes level from xp", () => {
    expect(xpToLevel(0)).toBe(1)
    expect(xpToLevel(100)).toBe(1)
    expect(xpToLevel(400)).toBe(2)
  })

  it("increments streak within window", () => {
    const now = new Date("2026-07-10T12:00:00Z")
    const last = new Date("2026-07-09T12:00:00Z")
    expect(computeProductStreak({ previousStreak: 2, lastPublishedAt: last, now })).toBe(3)
  })

  it("resets streak outside window", () => {
    const now = new Date("2026-07-10T12:00:00Z")
    const last = new Date("2026-07-01T12:00:00Z")
    expect(computeProductStreak({ previousStreak: 5, lastPublishedAt: last, now })).toBe(1)
  })

  it("applyXpAward detects level up", () => {
    const result = applyXpAward({
      currentXp: 350,
      previousStreak: 0,
      lastPublishedAt: null,
      publishedCount: 0,
    })
    expect(result.xpGained).toBe(50)
    expect(result.totalXp).toBe(400)
    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
    expect(result.isFirstProduct).toBe(true)
  })
})
