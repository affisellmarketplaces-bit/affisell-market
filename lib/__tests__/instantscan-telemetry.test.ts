import { describe, expect, it } from "vitest"

import {
  instantScanStageFromVisionVersion,
  trackInstantScanGateTriggered,
  trackInstantScanResult,
} from "@/lib/telemetry"
import { isAiVisionCascadeEnabled, isInstantScanEnabled } from "@/lib/ai/product-vision-v2-config"
import { isInstantScanServerEnabled } from "@/lib/instantscan/flags"

describe("instantscan telemetry", () => {
  it("maps vision version to InstantScan stage", () => {
    expect(instantScanStageFromVisionVersion("v2.2")).toBe("embed")
    expect(instantScanStageFromVisionVersion("v2")).toBe("gpt4o")
    expect(instantScanStageFromVisionVersion("v1")).toBe("groq")
    expect(instantScanStageFromVisionVersion("v2", "mini")).toBe("mini")
  })

  it("exports tracking helpers", () => {
    expect(typeof trackInstantScanResult).toBe("function")
    expect(typeof trackInstantScanGateTriggered).toBe("function")
  })
})

describe("ENABLE_INSTANTSCAN flag", () => {
  it("enables InstantScan and cascade when set", () => {
    expect(isInstantScanEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
    expect(isAiVisionCascadeEnabled({ ENABLE_INSTANTSCAN: "1" })).toBe(true)
    expect(isAiVisionCascadeEnabled({ ENABLE_AI_VISION_V2: "1" })).toBe(false)
  })

  it("falls back to legacy flags when INSTANTSCAN=0", () => {
    expect(isInstantScanServerEnabled({ ENABLE_INSTANTSCAN: "0", ENABLE_AI_VISION_V2: "1" })).toBe(
      true
    )
  })
})
