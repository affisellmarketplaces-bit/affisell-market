import { describe, expect, it } from "vitest"

import {
  EMPTY_PRICE_NUDGE_STATE,
  PRICE_NUDGE_COOLDOWN_MS,
  PRICE_NUDGE_MAX_DISMISSALS,
  parsePriceNudgeState,
  pulseAlertTargetCents,
  shouldShowPriceAlertNudge,
  stateAfterDismissed,
  stateAfterShown,
} from "@/lib/price-alert-nudge-policy"

const NOW = 1_800_000_000_000

describe("shouldShowPriceAlertNudge", () => {
  it("offers the sign-up to a first-time guest", () => {
    expect(shouldShowPriceAlertNudge({ state: EMPTY_PRICE_NUDGE_STATE, now: NOW, shownThisSession: false })).toBe(true)
  })

  it("never twice in the same browser session", () => {
    expect(shouldShowPriceAlertNudge({ state: EMPTY_PRICE_NUDGE_STATE, now: NOW, shownThisSession: true })).toBe(false)
  })

  it("waits a full day after the last offer", () => {
    const shown = stateAfterShown(EMPTY_PRICE_NUDGE_STATE, NOW)
    expect(shouldShowPriceAlertNudge({ state: shown, now: NOW + PRICE_NUDGE_COOLDOWN_MS - 1, shownThisSession: false })).toBe(false)
    expect(shouldShowPriceAlertNudge({ state: shown, now: NOW + PRICE_NUDGE_COOLDOWN_MS, shownThisSession: false })).toBe(true)
  })

  it("stops asking once the visitor said not-now a few times", () => {
    let state = EMPTY_PRICE_NUDGE_STATE
    for (let i = 0; i < PRICE_NUDGE_MAX_DISMISSALS - 1; i++) state = stateAfterDismissed(state)
    expect(shouldShowPriceAlertNudge({ state, now: NOW, shownThisSession: false })).toBe(true)
    state = stateAfterDismissed(state)
    expect(shouldShowPriceAlertNudge({ state, now: NOW + 365 * PRICE_NUDGE_COOLDOWN_MS, shownThisSession: false })).toBe(false)
  })

  it("a timestamp from the future (clock change) does not mute the offer for months", () => {
    const skewed = { lastShownAt: NOW + 90 * PRICE_NUDGE_COOLDOWN_MS, dismissals: 0 }
    expect(shouldShowPriceAlertNudge({ state: skewed, now: NOW, shownThisSession: false })).toBe(true)
    // …but a slightly-ahead clock still respects the cooldown
    const slightlyAhead = { lastShownAt: NOW + 1000, dismissals: 0 }
    expect(shouldShowPriceAlertNudge({ state: slightlyAhead, now: NOW, shownThisSession: false })).toBe(false)
  })
})

describe("parsePriceNudgeState", () => {
  it("round-trips a valid state", () => {
    const state = { lastShownAt: NOW, dismissals: 2 }
    expect(parsePriceNudgeState(JSON.stringify(state))).toEqual(state)
  })

  it("falls back to a clean state on missing, corrupt or hostile values", () => {
    for (const raw of [null, undefined, "", "not json", "null", "[]", '{"lastShownAt":"x","dismissals":-4}']) {
      expect(parsePriceNudgeState(raw as string | null)).toEqual(EMPTY_PRICE_NUDGE_STATE)
    }
    expect(parsePriceNudgeState('{"lastShownAt":0,"dismissals":1e9}')).toEqual({ lastShownAt: null, dismissals: 1000 })
  })

  it("state transitions are immutable", () => {
    const base = Object.freeze({ ...EMPTY_PRICE_NUDGE_STATE })
    expect(stateAfterShown(base, NOW)).toEqual({ lastShownAt: NOW, dismissals: 0 })
    expect(stateAfterDismissed(base)).toEqual({ lastShownAt: null, dismissals: 1 })
    expect(base).toEqual(EMPTY_PRICE_NUDGE_STATE)
  })
})

describe("pulseAlertTargetCents", () => {
  it("watches for a 5 % drop and never returns zero", () => {
    expect(pulseAlertTargetCents(1519)).toBe(1443)
    expect(pulseAlertTargetCents(10000)).toBe(9500)
    expect(pulseAlertTargetCents(1)).toBe(1)
    expect(pulseAlertTargetCents(0)).toBe(1)
  })
})
