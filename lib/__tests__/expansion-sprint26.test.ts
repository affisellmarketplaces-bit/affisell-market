import { describe, expect, it } from "vitest"

import { buildExpansionBounceCsv } from "@/lib/admin/build-expansion-bounce-csv"
import {
  EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT,
  shouldAutoResumeLaunchNotify,
} from "@/lib/expansion/expansion-auto-resume-notify"
import { findNextPilotCountry } from "@/lib/expansion/find-next-pilot-country"

describe("shouldAutoResumeLaunchNotify", () => {
  it("resumes at 80%+ delivery with min notified volume", () => {
    expect(
      shouldAutoResumeLaunchNotify({
        deliveredThisMonth: 80,
        notifiedCount: 100,
      })
    ).toBe(true)
  })

  it("skips when delivery rate is still low", () => {
    expect(
      shouldAutoResumeLaunchNotify({
        deliveredThisMonth: 40,
        notifiedCount: 100,
      })
    ).toBe(false)
  })

  it("skips below min notified threshold", () => {
    expect(
      shouldAutoResumeLaunchNotify({
        deliveredThisMonth: 8,
        notifiedCount: 8,
      })
    ).toBe(false)
  })

  it("uses 80% threshold constant", () => {
    expect(EXPANSION_AUTO_RESUME_DELIVERY_THRESHOLD_PCT).toBe(80)
  })
})

describe("findNextPilotCountry skip paused", () => {
  it("skips notify-paused countries when picking next pilot", () => {
    const result = findNextPilotCountry(
      [
        { countryIso2: "jp", waitlistCount: 100 },
        { countryIso2: "kr", waitlistCount: 50 },
      ],
      new Set(),
      new Set(),
      1,
      new Set(["JP"])
    )
    expect(result?.countryIso2).toBe("kr")
  })
})

describe("buildExpansionBounceCsv", () => {
  it("exports bounce rows with BOM", () => {
    const csv = buildExpansionBounceCsv([
      {
        countryIso2: "jp",
        emailKind: "checkout-launch",
        bouncedAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFcountryIso2;emailKind")).toBe(true)
    expect(csv).toContain("jp;checkout-launch")
  })
})
