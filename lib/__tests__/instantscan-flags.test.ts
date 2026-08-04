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

  it("disables when ENABLE_INSTANTSCAN=0 even if OpenAI key present", () => {
    expect(
      isInstantScanServerEnabled({
        ENABLE_INSTANTSCAN: "0",
        OPENAI_API_KEY: "sk-test",
      })
    ).toBe(false)
  })

  it("auto-enables when OpenAI key is configured", () => {
    expect(
      isInstantScanServerEnabled({
        ENABLE_INSTANTSCAN: "",
        ENABLE_AI_VISION_V2: "",
        OPENAI_API_KEY: "sk-test",
      })
    ).toBe(true)
  })

  it("stays off without flag and without OpenAI key", () => {
    expect(
      isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "", ENABLE_AI_VISION_V2: "", OPENAI_API_KEY: "" })
    ).toBe(false)
  })

  it("enables server when ENABLE_INSTANTSCAN=true", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "true" })).toBe(true)
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
