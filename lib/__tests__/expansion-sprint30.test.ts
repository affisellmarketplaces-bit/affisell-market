import { describe, expect, it } from "vitest"

import { expansionEmailEventsCsvFilename } from "@/lib/admin/build-expansion-email-events-csv"
import { loadExpansionEmailEventRows } from "@/lib/admin/load-expansion-email-event-rows"
import { launchFollowupPauseId } from "@/lib/expansion/launch-followup-pause"
import { normalizeExpansionEmailKindFilter } from "@/lib/expansion/normalize-expansion-email-kind-filter"

describe("normalizeExpansionEmailKindFilter", () => {
  it("accepts valid expansion email kinds", () => {
    expect(normalizeExpansionEmailKindFilter("checkout-launch")).toBe("checkout-launch")
    expect(normalizeExpansionEmailKindFilter("checkout-launch-followup")).toBe("checkout-launch-followup")
    expect(normalizeExpansionEmailKindFilter("checkout-graduated")).toBe("checkout-graduated")
  })

  it("rejects invalid kinds", () => {
    expect(normalizeExpansionEmailKindFilter("invalid")).toBeUndefined()
    expect(normalizeExpansionEmailKindFilter(null)).toBeUndefined()
  })
})

describe("expansionEmailEventsCsvFilename", () => {
  it("includes country and kind when filtered", () => {
    expect(expansionEmailEventsCsvFilename("jp", "checkout-launch")).toBe(
      "affisell-expansion-email-events-jp-checkout-launch-this-month.csv"
    )
  })
})

describe("loadExpansionEmailEventRows emailKind filter", () => {
  it("exports filter function signature", () => {
    expect(typeof loadExpansionEmailEventRows).toBe("function")
  })
})

describe("launchFollowupPauseId", () => {
  it("builds stable processed webhook id", () => {
    expect(launchFollowupPauseId("KR")).toMatch(/^expansion:launch-followup-paused:/)
    expect(launchFollowupPauseId("KR")).toContain(":kr")
  })
})
