"use client"

import {
  EMPTY_PRICE_NUDGE_STATE,
  PRICE_NUDGE_STORAGE_KEY,
  parsePriceNudgeState,
  shouldShowPriceAlertNudge,
  stateAfterDismissed,
  stateAfterShown,
  type PriceNudgeState,
} from "@/lib/price-alert-nudge-policy"

const SESSION_KEY = "affisell:price-alert-nudge-session"

function readState(): PriceNudgeState {
  try {
    return parsePriceNudgeState(window.localStorage.getItem(PRICE_NUDGE_STORAGE_KEY))
  } catch {
    return EMPTY_PRICE_NUDGE_STATE
  }
}

function writeState(state: PriceNudgeState): void {
  try {
    window.localStorage.setItem(PRICE_NUDGE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* private mode / quota — the offer simply behaves as "first time" next visit */
  }
}

function shownThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1"
  } catch {
    return false
  }
}

/** True when the guest should be offered the price-alert sign-up now (and records that it was shown). */
export function claimPriceAlertNudge(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false
  const state = readState()
  if (!shouldShowPriceAlertNudge({ state, now, shownThisSession: shownThisSession() })) return false
  writeState(stateAfterShown(state, now))
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1")
  } catch {
    /* ignore */
  }
  return true
}

/** The visitor tapped "not now". */
export function recordPriceAlertNudgeDismissed(): void {
  if (typeof window === "undefined") return
  writeState(stateAfterDismissed(readState()))
}
