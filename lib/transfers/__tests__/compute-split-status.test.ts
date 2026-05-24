import { describe, expect, it } from "vitest"

import { computeSplitStatusFromAttempts } from "@/lib/transfers/compute-split-status"

describe("computeSplitStatusFromAttempts", () => {
  it("returns SUCCESS when both attempts succeeded", () => {
    expect(
      computeSplitStatusFromAttempts([
        { status: "SUCCESS", attempts: 1 },
        { status: "SUCCESS", attempts: 1 },
      ])
    ).toBe("SUCCESS")
  })

  it("returns PARTIAL when supplier ok and affiliate failed", () => {
    expect(
      computeSplitStatusFromAttempts([
        { status: "SUCCESS", attempts: 1 },
        { status: "FAILED", attempts: 3 },
      ])
    ).toBe("PARTIAL")
  })

  it("returns PENDING when attempts still pending", () => {
    expect(
      computeSplitStatusFromAttempts([
        { status: "PENDING", attempts: 0 },
        { status: "PENDING", attempts: 0 },
      ])
    ).toBe("PENDING")
  })
})
