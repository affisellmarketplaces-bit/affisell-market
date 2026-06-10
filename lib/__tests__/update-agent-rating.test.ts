import { describe, expect, it } from "vitest"

import {
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
