import { describe, expect, it } from "vitest"

import {
  adjustAgentLeadTimeHours,
  adjustAgentRatingX10,
  AGENT_RATING_MAX_X10,
  AGENT_RATING_MIN_X10,
} from "@/lib/agents/update-agent-rating"

describe("adjustAgentRatingX10", () => {
  it("increments on PASSED", () => {
    expect(adjustAgentRatingX10(45, "PASSED")).toBe(46)
  })

  it("decrements on FAILED", () => {
    expect(adjustAgentRatingX10(45, "FAILED")).toBe(43)
  })

  it("clamps at ceiling", () => {
    expect(adjustAgentRatingX10(AGENT_RATING_MAX_X10, "PASSED")).toBe(AGENT_RATING_MAX_X10)
  })

  it("clamps at floor", () => {
    expect(adjustAgentRatingX10(AGENT_RATING_MIN_X10, "FAILED")).toBe(AGENT_RATING_MIN_X10)
  })
})

describe("adjustAgentLeadTimeHours", () => {
  it("blends previous SLA with actual turnaround", () => {
    const assignedAt = new Date("2026-06-01T10:00:00Z")
    const completedAt = new Date("2026-06-02T10:00:00Z")
    expect(adjustAgentLeadTimeHours(48, assignedAt, completedAt)).toBe(41)
  })

  it("never returns below 4 h floor", () => {
    const assignedAt = new Date("2026-06-01T10:00:00Z")
    const completedAt = new Date("2026-06-01T10:30:00Z")
    expect(adjustAgentLeadTimeHours(4, assignedAt, completedAt)).toBe(4)
  })

  it("clamps actual turnaround to 168 h max", () => {
    const assignedAt = new Date("2026-06-01T10:00:00Z")
    const completedAt = new Date("2026-06-20T10:00:00Z")
    expect(adjustAgentLeadTimeHours(48, assignedAt, completedAt)).toBe(84)
  })
})
