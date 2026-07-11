import { describe, expect, it } from "vitest"

import { isInstantScanServerEnabled } from "@/lib/instantscan/flags"

describe("instantscan flags", () => {
  it("enables when ENABLE_INSTANTSCAN=1", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
  })

  it("enables when ENABLE_AI_VISION_V2=1", () => {
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
})
