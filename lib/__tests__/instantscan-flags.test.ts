import { describe, expect, it } from "vitest"

import {
  getClientFlag,
  getInstantScanDisplayName,
  INSTANTSCAN_NAME,
  INSTANTSCAN_PRODUCT_NAME,
  isInstantScanServerEnabled,
} from "@/lib/instantscan/flags"

describe("instantscan flags", () => {
  it("enables server only when ENABLE_INSTANTSCAN=1|true (product retired)", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "true" })).toBe(true)
  })

  it("ignores ENABLE_AI_VISION_V2 and OpenAI key — InstantScan UI retired", () => {
    expect(isInstantScanServerEnabled({ ENABLE_AI_VISION_V2: "1" })).toBe(false)
    expect(
      isInstantScanServerEnabled({
        ENABLE_INSTANTSCAN: "",
        ENABLE_AI_VISION_V2: "",
        OPENAI_API_KEY: "sk-test",
      })
    ).toBe(false)
  })

  it("disables when ENABLE_INSTANTSCAN=0", () => {
    expect(
      isInstantScanServerEnabled({
        ENABLE_INSTANTSCAN: "0",
        OPENAI_API_KEY: "sk-test",
      })
    ).toBe(false)
  })

  it("stays off without explicit InstantScan flag", () => {
    expect(
      isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "", ENABLE_AI_VISION_V2: "", OPENAI_API_KEY: "" })
    ).toBe(false)
  })

  it("getClientFlag is false (InstantScan not offered in UI)", () => {
    expect(getClientFlag({})).toBe(false)
    expect(getClientFlag({ NEXT_PUBLIC_ENABLE_INSTANTSCAN: "1" })).toBe(false)
  })

  it("display name remains InstantScan product brand for dormant API", () => {
    expect(getInstantScanDisplayName()).toBe("⚡ InstantScan")
    expect(INSTANTSCAN_NAME).toBe(INSTANTSCAN_PRODUCT_NAME)
  })
})
