import { describe, expect, it } from "vitest"

import { buildGraduatedThisMonthDigestLines } from "@/lib/expansion/expansion-digest-graduated-month"

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

  it("shows none when count is zero", () => {
    expect(buildGraduatedThisMonthDigestLines(0, [], (iso2) => iso2)).toEqual([
      "Graduated this month: 0",
      "• none",
    ])
  })
})
