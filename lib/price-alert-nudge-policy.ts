/**
 * When to offer a guest "create an account to get the price alert" after they save a product (pure, no storage).
 *
 * The offer must help, never nag: at most once per browser session, then not again for a day, and never again after
 * the visitor has said "not now" a few times. Auto-dismissal (they simply kept swiping) does not count against us.
 */

export const PRICE_NUDGE_STORAGE_KEY = "affisell:price-alert-nudge"
export const PRICE_NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const PRICE_NUDGE_MAX_DISMISSALS = 3
/** Share of the current price a Pulse save watches for (−5 %). */
export const PULSE_PRICE_ALERT_RATIO = 0.95

export type PriceNudgeState = {
  /** epoch ms of the last time the offer was shown; null = never. */
  lastShownAt: number | null
  /** Explicit "not now" taps. */
  dismissals: number
}

export const EMPTY_PRICE_NUDGE_STATE: PriceNudgeState = { lastShownAt: null, dismissals: 0 }

/** Tolerant parse of whatever storage holds — corrupt or hostile values fall back to a clean state. */
export function parsePriceNudgeState(raw: string | null | undefined): PriceNudgeState {
  if (!raw) return EMPTY_PRICE_NUDGE_STATE
  try {
    const parsed = JSON.parse(raw) as { lastShownAt?: unknown; dismissals?: unknown } | null
    const lastShownAt =
      typeof parsed?.lastShownAt === "number" && Number.isFinite(parsed.lastShownAt) && parsed.lastShownAt > 0
        ? parsed.lastShownAt
        : null
    const dismissals =
      typeof parsed?.dismissals === "number" && Number.isFinite(parsed.dismissals) && parsed.dismissals > 0
        ? Math.min(1000, Math.floor(parsed.dismissals))
        : 0
    return { lastShownAt, dismissals }
  } catch {
    return EMPTY_PRICE_NUDGE_STATE
  }
}

export function shouldShowPriceAlertNudge(args: {
  state: PriceNudgeState
  now: number
  shownThisSession: boolean
}): boolean {
  const { state, now, shownThisSession } = args
  if (shownThisSession) return false
  if (state.dismissals >= PRICE_NUDGE_MAX_DISMISSALS) return false
  if (state.lastShownAt != null) {
    const elapsed = now - state.lastShownAt
    // A timestamp from the future (clock changed) must not mute the offer for months: only a plausible recent one counts.
    const plausible = elapsed >= 0 || -elapsed <= PRICE_NUDGE_COOLDOWN_MS
    if (plausible && elapsed < PRICE_NUDGE_COOLDOWN_MS) return false
  }
  return true
}

export function stateAfterShown(state: PriceNudgeState, now: number): PriceNudgeState {
  return { ...state, lastShownAt: now }
}

export function stateAfterDismissed(state: PriceNudgeState): PriceNudgeState {
  return { ...state, dismissals: state.dismissals + 1 }
}

/** The price (cents) a Pulse save watches for. */
export function pulseAlertTargetCents(priceCents: number): number {
  return Math.max(1, Math.round(priceCents * PULSE_PRICE_ALERT_RATIO))
}
