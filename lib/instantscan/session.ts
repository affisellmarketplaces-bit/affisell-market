/** Client-side InstantScan session guards (single-flight + rate-limit cooldown). */

export type InstantScanSessionState = {
  inFlight: boolean
  rateLimitUntilMs: number
  lastAttemptedUrl: string | null
}

export function createInstantScanSessionState(): InstantScanSessionState {
  return { inFlight: false, rateLimitUntilMs: 0, lastAttemptedUrl: null }
}

export function canStartInstantScanAnalyze(
  state: InstantScanSessionState,
  _imageUrl: string,
  nowMs = Date.now()
): { ok: true } | { ok: false; reason: "in_flight" | "rate_limited"; retryAfterSec?: number } {
  if (state.inFlight) return { ok: false, reason: "in_flight" }
  if (state.rateLimitUntilMs > nowMs) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSec: Math.max(1, Math.ceil((state.rateLimitUntilMs - nowMs) / 1000)),
    }
  }
  return { ok: true }
}

export function markInstantScanAnalyzeStart(state: InstantScanSessionState, imageUrl: string): void {
  state.inFlight = true
  state.lastAttemptedUrl = imageUrl
}

export function markInstantScanAnalyzeEnd(state: InstantScanSessionState): void {
  state.inFlight = false
}

export function markInstantScanRateLimited(
  state: InstantScanSessionState,
  retryAfterSec: number,
  nowMs = Date.now()
): void {
  state.rateLimitUntilMs = nowMs + Math.max(retryAfterSec, 1) * 1000
  state.inFlight = false
}

export function resetInstantScanSession(state: InstantScanSessionState): void {
  state.inFlight = false
  state.lastAttemptedUrl = null
  state.rateLimitUntilMs = 0
}
