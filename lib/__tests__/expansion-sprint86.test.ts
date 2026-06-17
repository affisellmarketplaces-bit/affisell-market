import { describe, expect, it } from "vitest"

import {
  countExpansionAdminMultiAlertZipHiddenCountries,
  formatExpansionAdminMultiAlertZipViewAllLabel,
  shouldShowExpansionAdminMultiAlertZipViewAllLink,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

describe("countExpansionAdminMultiAlertZipHiddenCountries", () => {
  it("counts countries hidden in preview bar", () => {
    expect(countExpansionAdminMultiAlertZipHiddenCountries(5, 3)).toBe(2)
  })

  it("returns zero when all countries are visible", () => {
    expect(countExpansionAdminMultiAlertZipHiddenCountries(3, 3)).toBe(0)
  })
})

describe("formatExpansionAdminMultiAlertZipViewAllLabel", () => {
  it("shows hidden country count in preview mode", () => {
    expect(
      formatExpansionAdminMultiAlertZipViewAllLabel({
        totalCount: 5,
        visibleCount: 3,
      })
    ).toBe("View all (+2 hidden)")
  })

  it("falls back to total count when nothing is hidden", () => {
    expect(
      formatExpansionAdminMultiAlertZipViewAllLabel({
        totalCount: 3,
        visibleCount: 3,
      })
    ).toBe("View all (3)")
  })
})

describe("shouldShowExpansionAdminMultiAlertZipViewAllLink", () => {
  it("shows view-all when preview hides countries", () => {
    expect(
      shouldShowExpansionAdminMultiAlertZipViewAllLink({
        filtered: false,
        totalCount: 5,
        visibleCount: 3,
      })
    ).toBe(true)
    expect(
      formatExpansionAdminMultiAlertZipViewAllLabel({
        totalCount: 5,
        visibleCount: 3,
      })
    ).toBe("View all (+2 hidden)")
  })
})
