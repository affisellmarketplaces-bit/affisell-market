import { describe, expect, it } from "vitest"

import {
  getClientFlag,
  getInstantScanDisplayName,
  INSTANTSCAN_NAME,
  isInstantScanBranded,
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

  it("getClientFlag reads NEXT_PUBLIC_ENABLE_INSTANTSCAN", () => {
    expect(getClientFlag({ NEXT_PUBLIC_ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("getClientFlag reads NEXT_PUBLIC_ENABLE_AI_VISION_V2", () => {
    expect(getClientFlag({ NEXT_PUBLIC_ENABLE_AI_VISION_V2: "1" })).toBe(true)
  })

  it("INSTANTSCAN_NAME is branded when NEXT_PUBLIC_ENABLE_INSTANTSCAN=1", () => {
    expect(getInstantScanDisplayName({ NEXT_PUBLIC_ENABLE_INSTANTSCAN: "1" })).toBe(
      "⚡ InstantScan"
    )
    expect(isInstantScanBranded({ NEXT_PUBLIC_ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("INSTANTSCAN_NAME falls back to Guidé without flag", () => {
    expect(getInstantScanDisplayName({})).toBe("Guidé")
    expect(typeof INSTANTSCAN_NAME).toBe("string")
  })
})
