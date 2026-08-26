import { describe, expect, it } from "vitest"

import { formatIngObservedAt } from "@/lib/ai-engineer/format-observed-at"

describe("formatIngObservedAt", () => {
  it("formats ISO timestamps in UTC (hydration-safe)", () => {
    expect(formatIngObservedAt("2026-08-26T10:30:00.000Z")).toBe("10:30 UTC")
  })

  it("returns dash for invalid input", () => {
    expect(formatIngObservedAt("not-a-date")).toBe("—")
  })
})
