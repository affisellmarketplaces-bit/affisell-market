import { describe, expect, it } from "vitest"

import {
  findGraduationEmailStalls,
  GRADUATION_EMAIL_STALL_MS,
} from "@/lib/expansion/graduation-email-stall"

describe("graduation-email-stall", () => {
  it("findGraduationEmailStalls flags countries graduated 48h+ without buyer email", () => {
    const now = Date.parse("2026-06-10T12:00:00.000Z")
    const stalls = findGraduationEmailStalls(
      [
        { countryIso2: "JP", graduatedAt: new Date(now - GRADUATION_EMAIL_STALL_MS - 60_000) },
        { countryIso2: "BR", graduatedAt: new Date(now - 3_600_000) },
      ],
      now
    )

    expect(stalls.map((row) => row.countryIso2)).toEqual(["JP"])
  })
})
