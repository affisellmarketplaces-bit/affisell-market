import { describe, expect, it } from "vitest"

import { utcDay } from "@/lib/radar/writers/global-snapshot"

describe("utcDay", () => {
  it("truncates to UTC midnight", () => {
    const d = new Date("2026-07-19T15:42:11.123Z")
    const day = utcDay(d)
    expect(day.toISOString()).toBe("2026-07-19T00:00:00.000Z")
  })

  it("is stable for same calendar day", () => {
    const a = utcDay(new Date("2026-07-19T01:00:00.000Z"))
    const b = utcDay(new Date("2026-07-19T23:59:59.999Z"))
    expect(a.getTime()).toBe(b.getTime())
  })

  it("differs across UTC days", () => {
    const a = utcDay(new Date("2026-07-18T23:00:00.000Z"))
    const b = utcDay(new Date("2026-07-19T01:00:00.000Z"))
    expect(a.getTime()).not.toBe(b.getTime())
  })
})
