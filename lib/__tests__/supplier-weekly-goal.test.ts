import { describe, expect, it } from "vitest"

import {
  startOfUtcWeek,
  weeklyGoalFilledSegments,
  weeklyGoalProgressPct,
  WEEKLY_GOAL_BAR_SEGMENTS,
} from "@/lib/supplier-weekly-goal"

describe("startOfUtcWeek", () => {
  it("returns Monday UTC for a Wednesday", () => {
    const wed = new Date("2026-05-20T15:00:00.000Z")
    const mon = startOfUtcWeek(wed)
    expect(mon.toISOString()).toBe("2026-05-18T00:00:00.000Z")
  })
})

describe("weeklyGoalProgressPct", () => {
  it("caps at 100%", () => {
    expect(weeklyGoalProgressPct(10_300, 50_000)).toBe(20)
    expect(weeklyGoalProgressPct(60_000, 50_000)).toBe(100)
  })
})

describe("weeklyGoalFilledSegments", () => {
  it("maps percent to bar blocks", () => {
    expect(weeklyGoalFilledSegments(20, WEEKLY_GOAL_BAR_SEGMENTS)).toBe(2)
    expect(weeklyGoalFilledSegments(100, WEEKLY_GOAL_BAR_SEGMENTS)).toBe(10)
  })
})
