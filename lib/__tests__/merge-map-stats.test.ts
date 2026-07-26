import { describe, expect, it } from "vitest"

import { mergeMapStatsWithExpected, type CountryMapStat } from "@/lib/radar/map/geo"

describe("mergeMapStatsWithExpected", () => {
  it("keeps live countries and fills pending for expected gaps", () => {
    const live: CountryMapStat[] = [
      { country: "FR", count: 193, avgSales: 10, topProductTitle: "A" },
      { country: "US", count: 241, avgSales: 20, topProductTitle: "B" },
    ]
    const merged = mergeMapStatsWithExpected(live, ["FR", "US", "JP", "BR"])
    expect(merged).toHaveLength(4)
    expect(merged.find((s) => s.country === "FR")?.count).toBe(193)
    expect(merged.find((s) => s.country === "JP")?.pending).toBe(true)
    expect(merged.find((s) => s.country === "JP")?.count).toBe(0)
  })
})
