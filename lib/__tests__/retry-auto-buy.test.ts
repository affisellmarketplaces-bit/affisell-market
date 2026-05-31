import { describe, expect, it } from "vitest"

import { canRetryAutoBuyLog } from "@/lib/admin/auto-fulfill/retry-auto-buy"

describe("canRetryAutoBuyLog", () => {
  it("allows PENDING and FAILED under max attempts", () => {
    expect(canRetryAutoBuyLog({ status: "PENDING", attempts: 0 })).toBe(true)
    expect(canRetryAutoBuyLog({ status: "FAILED", attempts: 2 })).toBe(true)
  })

  it("blocks BOUGHT and exhausted FAILED", () => {
    expect(canRetryAutoBuyLog({ status: "BOUGHT", attempts: 1 })).toBe(false)
    expect(canRetryAutoBuyLog({ status: "FAILED", attempts: 3 })).toBe(false)
  })
})
