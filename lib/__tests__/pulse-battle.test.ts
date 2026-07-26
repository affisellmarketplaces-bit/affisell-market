import { describe, expect, it } from "vitest"

import { nextParisBattleSlot } from "@/lib/pulse/battle-engine"
import {
  BATTLE_DEFAULT_FLASH_PCT,
  BATTLE_DURATION_MS,
  BATTLE_FLASH_MS,
} from "@/lib/pulse/battle-types"

describe("pulse battle constants", () => {
  it("has 15min battle and 5min flash", () => {
    expect(BATTLE_DURATION_MS).toBe(15 * 60 * 1000)
    expect(BATTLE_FLASH_MS).toBe(5 * 60 * 1000)
    expect(BATTLE_DEFAULT_FLASH_PCT).toBe(20)
  })

  it("nextParisBattleSlot returns a future Date", () => {
    const now = new Date("2026-07-26T10:00:00.000Z")
    const slot = nextParisBattleSlot(now)
    expect(slot.getTime()).toBeGreaterThan(now.getTime())
  })
})
