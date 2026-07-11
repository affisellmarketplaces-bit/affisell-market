import { describe, expect, it } from "vitest"

import {
  getClientFlag,
  getInstantScanDisplayName,
  INSTANTSCAN_NAME,
  INSTANTSCAN_PRODUCT_NAME,
  isInstantScanServerEnabled,
} from "@/lib/instantscan/flags"

describe("instantscan flags", () => {
  it("enables server when ENABLE_INSTANTSCAN=1", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("enables server when ENABLE_AI_VISION_V2=1", () => {
    expect(isInstantScanServerEnabled({ ENABLE_AI_VISION_V2: "1" })).toBe(true)
  })

  it("disables when ENABLE_INSTANTSCAN empty string", () => {
    expect(
      isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "", ENABLE_AI_VISION_V2: "" })
    ).toBe(false)
  })

  it("disables truthy strings other than 1", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "true" })).toBe(false)
  })

  it("getClientFlag is always true (API is source of truth)", () => {
    expect(getClientFlag({})).toBe(true)
    expect(getClientFlag({ NEXT_PUBLIC_ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("display name is always InstantScan product brand", () => {
    expect(getInstantScanDisplayName()).toBe("⚡ InstantScan")
    expect(INSTANTSCAN_NAME).toBe(INSTANTSCAN_PRODUCT_NAME)
  })
})
