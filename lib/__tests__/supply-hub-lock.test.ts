import { describe, expect, it } from "vitest"

import {
  SUPPLY_HUB_CHANNEL_DEFS,
  SUPPLY_HUB_UNLOCKED_CHANNELS,
  lockSupplyHubConnectors,
  type SupplyHubConnectorSnapshot,
} from "@/lib/supplier/supply-hub-shared"

function fakeConnectors(): SupplyHubConnectorSnapshot[] {
  return SUPPLY_HUB_CHANNEL_DEFS.map((def) => ({
    channelType: def.channelType,
    labelKey: def.labelKey,
    uiStatus: "connected",
    phase: def.phase,
    capabilities: def.capabilities,
    href: def.href ?? "/x",
    stats: { linkedSkus: 3 },
    hintKey: "h",
  }))
}

describe("supply hub channel lock", () => {
  it("only Affisell stock + Manual stay unlocked for suppliers", () => {
    const locked = lockSupplyHubConnectors(fakeConnectors())
    for (const c of locked) {
      if (SUPPLY_HUB_UNLOCKED_CHANNELS.has(c.channelType)) {
        expect(c.uiStatus).toBe("connected")
        expect(c.href).toBeTruthy()
      } else {
        expect(c.uiStatus).toBe("roadmap")
        expect(c.href).toBeUndefined()
        expect(c.stats).toBeUndefined()
        expect(c.hintKey).toBeUndefined()
      }
    }
    expect(SUPPLY_HUB_UNLOCKED_CHANNELS.has("AFFISELL_NATIVE")).toBe(true)
    expect(SUPPLY_HUB_UNLOCKED_CHANNELS.has("MANUAL")).toBe(true)
    expect(SUPPLY_HUB_UNLOCKED_CHANNELS.size).toBe(2)
  })

  it("unlockAll keeps real statuses for the admin Supply Lab", () => {
    const open = lockSupplyHubConnectors(fakeConnectors(), { unlockAll: true })
    expect(open.every((c) => c.uiStatus === "connected" && c.href)).toBe(true)
  })
})
