import { describe, expect, it } from "vitest"

import {
  canStartInstantScanAnalyze,
  createInstantScanSessionState,
  markInstantScanAnalyzeStart,
  markInstantScanRateLimited,
  resetInstantScanSession,
} from "@/lib/instantscan/session"

describe("instantscan session", () => {
  it("blocks concurrent in-flight analyze", () => {
    const state = createInstantScanSessionState()
    markInstantScanAnalyzeStart(state, "https://cdn.example.com/a.jpg")
    expect(canStartInstantScanAnalyze(state, "https://cdn.example.com/a.jpg")).toEqual({
      ok: false,
      reason: "in_flight",
    })
  })

  it("blocks during rate-limit cooldown", () => {
    const state = createInstantScanSessionState()
    markInstantScanRateLimited(state, 60, 1_000_000)
    const gate = canStartInstantScanAnalyze(state, "https://cdn.example.com/b.jpg", 1_010_000)
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.reason).toBe("rate_limited")
      expect(gate.retryAfterSec).toBeGreaterThan(0)
    }
  })

  it("reset clears cooldown and in-flight", () => {
    const state = createInstantScanSessionState()
    markInstantScanAnalyzeStart(state, "https://cdn.example.com/c.jpg")
    markInstantScanRateLimited(state, 60, Date.now())
    resetInstantScanSession(state)
    expect(canStartInstantScanAnalyze(state, "https://cdn.example.com/c.jpg")).toEqual({ ok: true })
  })
})
