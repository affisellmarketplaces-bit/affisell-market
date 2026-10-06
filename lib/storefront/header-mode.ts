/**
 * Scroll-aware storefront header — the rules, as a pure state machine (no DOM, no React).
 *
 *   "full"   — at the top of the page: main bar + trust rail.
 *   "hidden" — the visitor is reading DOWN: the header slides away and the screen belongs to the products.
 *   "bar"    — the visitor scrolls UP: the header comes straight back, but only the compact main bar — the trust rail
 *              (needed once, at arrival) folds away so the header never costs more than a bar.
 *
 * Small movements change nothing (touch scrolling jitters; a header that flickers is worse than one that never hides),
 * and near the top the header is always complete.
 */
export type HeaderMode = "full" | "bar" | "hidden"

export type HeaderModeState = { mode: HeaderMode; lastY: number }

/** Below this scroll offset the header is always "full". */
export const HEADER_TOP_ZONE_PX = 120
/** A scroll movement must exceed this to count as a direction change. */
export const HEADER_SCROLL_DELTA_PX = 8

export function nextHeaderMode(
  state: HeaderModeState,
  rawY: number,
  opts: { topZonePx?: number; deltaPx?: number; maxY?: number } = {}
): HeaderModeState {
  const { topZonePx = HEADER_TOP_ZONE_PX, deltaPx = HEADER_SCROLL_DELTA_PX, maxY } = opts
  // iOS rubber-banding reports negative offsets at the top.
  const y = Math.max(0, rawY)

  if (y < topZonePx) return { mode: "full", lastY: y }

  // Rubber-banding past the END of the page: the bounce out reads as "down" and the elastic return as "up", which would
  // pop the header back over the footer. An offset beyond the real maximum is not the visitor's reading direction.
  if (maxY !== undefined && y > maxY + 1) return state

  const dy = y - state.lastY
  if (dy > deltaPx) return { mode: "hidden", lastY: y }
  if (dy < -deltaPx) return { mode: "bar", lastY: y }
  return state
}

/**
 * The scroll offset changed because the viewport did (iOS toolbar collapsing, rotation) — not because the visitor scrolled.
 * Keep the mode and move the reference point, so the next real gesture is measured from where the page now is.
 */
export function rebaseHeaderMode(state: HeaderModeState, rawY: number): HeaderModeState {
  return { mode: state.mode, lastY: Math.max(0, rawY) }
}

/** A header the visitor is using (menu open, keyboard focus inside) is never left hidden. */
export function visibleHeaderMode(mode: HeaderMode, keepVisible: boolean): HeaderMode {
  return keepVisible && mode === "hidden" ? "bar" : mode
}
