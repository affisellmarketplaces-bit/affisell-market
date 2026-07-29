import { describe, expect, it } from "vitest"

import { resolveBattleContenderPlacement } from "@/lib/pulse/battle-contender-shared"

describe("resolveBattleContenderPlacement", () => {
  it("keeps side when preferred already A", () => {
    const r = resolveBattleContenderPlacement({
      productAId: "p1",
      productBId: "p2",
      preferredProductId: "p1",
      ownsA: true,
      ownsB: false,
    })
    expect(r).toMatchObject({
      productAId: "p1",
      productBId: "p2",
      side: "A",
      unchanged: true,
      needsOpponent: false,
    })
  })

  it("replaces owned A with preferred", () => {
    const r = resolveBattleContenderPlacement({
      productAId: "old",
      productBId: "opp",
      preferredProductId: "mine",
      ownsA: true,
      ownsB: false,
    })
    expect(r).toMatchObject({
      productAId: "mine",
      productBId: "opp",
      side: "A",
      unchanged: false,
      needsOpponent: false,
    })
  })

  it("injects as A when reseller owns neither", () => {
    const r = resolveBattleContenderPlacement({
      productAId: "x",
      productBId: "y",
      preferredProductId: "mine",
      ownsA: false,
      ownsB: false,
    })
    expect(r).toMatchObject({
      productAId: "mine",
      productBId: "y",
      side: "A",
      unchanged: false,
      needsOpponent: false,
    })
  })

  it("flags needsOpponent when B collides with preferred", () => {
    const r = resolveBattleContenderPlacement({
      productAId: "x",
      productBId: "mine",
      preferredProductId: "mine",
      ownsA: false,
      ownsB: false,
    })
    expect(r.unchanged).toBe(true)
    expect(r.side).toBe("B")
  })
})
