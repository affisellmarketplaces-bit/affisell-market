import { describe, expect, it } from "vitest"

import {
  canApplyPresetAbWinner,
  formatPresetAbExperimentStatus,
  formatPresetAbWinnerVariant,
  getPresetAbDaysRemaining,
} from "@/lib/storefront-preset-ab-winner-shared"

const runningAb = {
  enabled: true,
  challengerPresetId: "midnight-orbit",
  startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  viewsControl: 30,
  viewsChallenger: 40,
}

describe("storefront-preset-ab-winner-shared", () => {
  it("formats winner variant label", () => {
    expect(formatPresetAbWinnerVariant({ variant: "challenger", locale: "en" })).toContain("Challenger")
  })

  it("detects when winner can be applied", () => {
    expect(canApplyPresetAbWinner(runningAb)).toBe(true)
  })

  it("shows ready status when winner is clear", () => {
    const status = formatPresetAbExperimentStatus({ presetAb: runningAb, locale: "en" })
    expect(status).toContain("Ready to apply")
  })

  it("returns zero days remaining after 7d", () => {
    expect(getPresetAbDaysRemaining(runningAb)).toBe(0)
  })
})
