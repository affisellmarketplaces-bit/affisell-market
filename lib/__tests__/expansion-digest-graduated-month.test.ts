import { describe, expect, it } from "vitest"

import { buildGraduatedThisMonthDigestLines } from "@/lib/expansion/expansion-digest-graduated-month"
import { resolveExpansionEmailKind } from "@/lib/expansion/resolve-expansion-email-kind"
import { EXPANSION_CHECKOUT_LAUNCH_TAG } from "@/lib/expansion/expansion-email-tags"

describe("buildGraduatedThisMonthDigestLines", () => {
  it("lists graduated countries with dates", () => {
    expect(
      buildGraduatedThisMonthDigestLines(
        2,
        [
          { countryIso2: "jp", graduatedAt: "2026-06-08T12:00:00.000Z" },
          { countryIso2: "br", graduatedAt: "2026-06-02T09:00:00.000Z" },
        ],
        (iso2) => iso2.toUpperCase()
      )
    ).toEqual([
      "Graduated this month: 2",
      "• JP (jp) — 2026-06-08",
      "• BR (br) — 2026-06-02",
    ])
  })

  it("appends browse URLs when provided", () => {
    expect(
      buildGraduatedThisMonthDigestLines(
        1,
        [{ countryIso2: "jp", graduatedAt: "2026-06-08T12:00:00.000Z" }],
        (iso2) => iso2.toUpperCase(),
        (iso2) => `https://affisell.com/shops/browse?shipsTo=${iso2}`
      )
    ).toEqual([
      "Graduated this month: 1",
      "• JP (jp) — 2026-06-08\n  Shop: https://affisell.com/shops/browse?shipsTo=jp",
    ])
  })

  it("shows none when count is zero", () => {
    expect(buildGraduatedThisMonthDigestLines(0, [], (iso2) => iso2)).toEqual([
      "Graduated this month: 0",
      "• none",
    ])
  })
})

describe("resolveExpansionEmailKind", () => {
  it("reads checkout-launch from resend tags", () => {
    expect(
      resolveExpansionEmailKind({
        tags: [EXPANSION_CHECKOUT_LAUNCH_TAG],
      })
    ).toBe("checkout-launch")
  })
})
