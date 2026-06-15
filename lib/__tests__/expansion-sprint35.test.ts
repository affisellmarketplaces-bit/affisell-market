import { describe, expect, it } from "vitest"

import { buildExpansionBounceCsv } from "@/lib/admin/build-expansion-bounce-csv"
import { graduationEmailPauseId } from "@/lib/expansion/graduation-email-pause"
import { loadExpansionGraduatedEmailStatsByCountry } from "@/lib/expansion/load-expansion-graduated-email-stats-by-country"
import { runExpansionGraduatedDeliveryRateAlert } from "@/lib/cron/expansion-graduated-delivery-rate-alert"
import { runExpansionAutoPauseGraduationCron } from "@/lib/cron/expansion-auto-pause-graduation"

describe("buildExpansionBounceCsv buyerEmailHash", () => {
  it("includes buyerEmailHash column", () => {
    const csv = buildExpansionBounceCsv([
      {
        countryIso2: "jp",
        emailKind: "checkout-launch",
        buyerEmailHash: "abc123def4567890",
        bouncedAt: new Date("2026-06-10T12:00:00.000Z"),
      },
    ])
    expect(csv.startsWith("\uFEFFcountryIso2;emailKind;buyerEmailHash;bouncedAt")).toBe(true)
    expect(csv).toContain("abc123def4567890")
  })
})

describe("graduationEmailPauseId", () => {
  it("builds stable processed webhook id", () => {
    expect(graduationEmailPauseId("JP")).toMatch(/^expansion:graduation-email-paused:/)
    expect(graduationEmailPauseId("JP")).toContain(":jp")
  })
})

describe("loadExpansionGraduatedEmailStatsByCountry", () => {
  it("exports loader function", () => {
    expect(typeof loadExpansionGraduatedEmailStatsByCountry).toBe("function")
  })
})

describe("runExpansionGraduatedDeliveryRateAlert", () => {
  it("exports alert function", () => {
    expect(typeof runExpansionGraduatedDeliveryRateAlert).toBe("function")
  })
})

describe("runExpansionAutoPauseGraduationCron", () => {
  it("exports auto-pause function", () => {
    expect(typeof runExpansionAutoPauseGraduationCron).toBe("function")
  })
})
