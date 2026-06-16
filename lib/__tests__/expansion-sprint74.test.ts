import { describe, expect, it } from "vitest"

import {
  buildExpansionAdminMultiAlertBundleLinks,
  formatExpansionAdminMultiAlertBundleLinkLabel,
  formatExpansionAdminTopMultiAlertBundleLabel,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

const baseRow = {
  countryIso2: "jp",
  funnel: { notifiedCount: 12 },
  launchComplaintsThisMonth: 0,
  launchBounceRetriesPending: 0,
  launchBounceSuppressed: 0,
  launchDeliveryRatePct: 90,
  launchFollowupSentThisMonth: 0,
  launchFollowupComplaintsThisMonth: 0,
  launchFollowupBouncesThisMonth: 0,
  launchFollowupDeliveryRatePct: 90,
  launchGraduatedSentThisMonth: 0,
  launchGraduatedComplaintsThisMonth: 0,
  launchGraduatedBouncesThisMonth: 0,
  launchGraduatedDeliveryRatePct: 90,
}

describe("formatExpansionAdminMultiAlertBundleLinkLabel", () => {
  it("shows country code with human-readable signal labels", () => {
    expect(
      formatExpansionAdminMultiAlertBundleLinkLabel("kr", [
        "launch complaint",
        "launch delivery",
      ])
    ).toBe("KR · launch complaint, launch delivery")
  })
})

describe("formatExpansionAdminTopMultiAlertBundleLabel", () => {
  it("appends ZIP suffix to labeled chip text", () => {
    expect(
      formatExpansionAdminTopMultiAlertBundleLabel({
        ...baseRow,
        launchComplaintsThisMonth: 1,
        launchBounceRetriesPending: 1,
      })
    ).toBe("JP · launch complaint, launch bounce ZIP")
  })
})

describe("buildExpansionAdminMultiAlertBundleLinks", () => {
  it("uses signal labels in bar chip text", () => {
    const links = buildExpansionAdminMultiAlertBundleLinks([
      {
        ...baseRow,
        countryIso2: "kr",
        launchComplaintsThisMonth: 1,
        launchDeliveryRatePct: 55,
      },
    ])
    expect(links[0]?.label).toBe("KR · launch complaint, launch delivery")
  })
})
