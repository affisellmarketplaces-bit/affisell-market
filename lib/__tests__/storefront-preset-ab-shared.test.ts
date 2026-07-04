import { describe, expect, it } from "vitest"

import {
  evaluatePresetAbWinner,
  incrementPresetAbViews,
  pickPresetAbVariant,
} from "@/lib/storefront-preset-ab-shared"

const baseAb = {
  enabled: true,
  challengerPresetId: "midnight-orbit",
  startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  viewsControl: 15,
  viewsChallenger: 18,
}

describe("storefront-preset-ab-shared", () => {
  it("picks stable variant from session key", () => {
    expect(pickPresetAbVariant("abc")).toBe(pickPresetAbVariant("abc"))
  })

  it("increments views by variant", () => {
    const next = incrementPresetAbViews(baseAb, "challenger")
    expect(next.viewsChallenger).toBe(baseAb.viewsChallenger + 1)
  })

  it("declares challenger winner with uplift", () => {
    const result = evaluatePresetAbWinner({
      ...baseAb,
      viewsControl: 10,
      viewsChallenger: 25,
    })
    expect(result.winner).toBe("challenger")
  })

  it("waits when insufficient views", () => {
    const result = evaluatePresetAbWinner({ ...baseAb, viewsControl: 2, viewsChallenger: 3 })
    expect(result.winner).toBeNull()
  })
})
