import { describe, expect, it } from "vitest"

/** Pure ranking helper mirrored by API ORDER BY sales_count DESC, total_gmv DESC */
function rankLeaderboardRows(
  rows: Array<{ username: string; salesCount: number; totalGmv: number }>
) {
  return [...rows].sort(
    (a, b) => b.salesCount - a.salesCount || b.totalGmv - a.totalGmv
  )
}

describe("legion leaderboard ranking", () => {
  it("ranks by sales then GMV", () => {
    const ranked = rankLeaderboardRows([
      { username: "b", salesCount: 2, totalGmv: 200 },
      { username: "a", salesCount: 3, totalGmv: 100 },
      { username: "c", salesCount: 2, totalGmv: 250 },
    ])
    expect(ranked.map((r) => r.username)).toEqual(["a", "c", "b"])
  })

  it("keeps empty ranking stable", () => {
    expect(rankLeaderboardRows([])).toEqual([])
  })
})
