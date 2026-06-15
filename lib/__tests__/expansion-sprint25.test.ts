import { describe, expect, it } from "vitest"

import {
  EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT,
  shouldAutoPauseLaunchNotify,
} from "@/lib/expansion/expansion-auto-pause-notify"
import { launchNotifyPauseId } from "@/lib/expansion/launch-notify-pause"

describe("shouldAutoPauseLaunchNotify", () => {
  it("pauses below 50% delivery with min notified volume", () => {
    expect(
      shouldAutoPauseLaunchNotify({
        deliveredThisMonth: 4,
        notifiedCount: 100,
      })
    ).toBe(true)
  })

  it("skips when delivery rate is healthy", () => {
    expect(
      shouldAutoPauseLaunchNotify({
        deliveredThisMonth: 60,
        notifiedCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldAutoPauseLaunchNotify({
        deliveredThisMonth: 0,
        notifiedCount: 5,
      })
    ).toBe(false)
  })

  it("pauses when zero delivered with enough notified", () => {
    expect(
      shouldAutoPauseLaunchNotify({
        deliveredThisMonth: 0,
        notifiedCount: 20,
      })
    ).toBe(true)
  })

  it("uses 50% threshold constant", () => {
    expect(EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT).toBe(50)
  })
})

describe("launchNotifyPauseId", () => {
  it("builds stable processed webhook id", () => {
    expect(launchNotifyPauseId("JP")).toMatch(/^expansion:launch-notify-paused:/)
    expect(launchNotifyPauseId("JP")).toContain(":jp")
  })
})
