import { describe, expect, it } from "vitest"

import {
  isInDayReminderWindow,
  isInHourReminderWindow,
  msUntilBookingStart,
} from "@/lib/booking/reminder-windows"

describe("booking reminder windows", () => {
  const now = new Date("2026-06-10T10:00:00.000Z")

  it("computes ms until start", () => {
    const startsAt = new Date("2026-06-11T10:00:00.000Z")
    expect(msUntilBookingStart(startsAt, now)).toBe(24 * 60 * 60 * 1000)
  })

  it("matches J-1 window around 24h", () => {
    expect(isInDayReminderWindow(new Date("2026-06-11T10:00:00.000Z"), now)).toBe(true)
    expect(isInDayReminderWindow(new Date("2026-06-11T06:00:00.000Z"), now)).toBe(false)
    expect(isInDayReminderWindow(new Date("2026-06-11T14:00:00.000Z"), now)).toBe(false)
  })

  it("matches H-2 window around 2h", () => {
    expect(isInHourReminderWindow(new Date("2026-06-10T12:00:00.000Z"), now)).toBe(true)
    expect(isInHourReminderWindow(new Date("2026-06-10T11:00:00.000Z"), now)).toBe(false)
    expect(isInHourReminderWindow(new Date("2026-06-10T13:30:00.000Z"), now)).toBe(false)
  })
})
