import { describe, expect, it } from "vitest"

import { isExpansionAutoPilotEnabled } from "@/lib/cron/expansion-auto-pilot"

describe("expansion-auto-pilot", () => {
  it("is disabled by default", () => {
    delete process.env.EXPANSION_AUTO_PILOT_ON_FIRST_ORDER
    expect(isExpansionAutoPilotEnabled()).toBe(false)
  })

  it("is enabled when env is 1", () => {
    process.env.EXPANSION_AUTO_PILOT_ON_FIRST_ORDER = "1"
    expect(isExpansionAutoPilotEnabled()).toBe(true)
    delete process.env.EXPANSION_AUTO_PILOT_ON_FIRST_ORDER
  })
})
