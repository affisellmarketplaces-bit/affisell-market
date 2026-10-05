/**
 * Where to put a fixed dropdown panel opened from a trigger button — guaranteed to stay fully inside the viewport
 * (pure, no DOM). The old math right-aligned the panel to the trigger with a width of `min(100vw - 1.5rem, 26rem)`:
 * fine when the trigger hugs the right edge, but when other controls sit to its right (language switcher, avatar) the
 * panel's left edge landed off-screen and its text was cut.
 */

export type AnchoredPanelPosition = {
  top: number
  /** Set on phones (panel spans the screen with side margins). */
  left?: number
  /** Set on larger screens (panel hangs from the trigger's right edge). */
  right?: number
  width: number
}

export const PANEL_SHEET_BELOW_PX = 640
export const PANEL_MAX_WIDTH_PX = 416
export const PANEL_MIN_WIDTH_PX = 280

export function computeAnchoredPanelPosition(args: {
  anchor: { bottom: number; right: number }
  viewportWidth: number
  margin?: number
  gap?: number
  maxWidth?: number
}): AnchoredPanelPosition {
  const { anchor, viewportWidth } = args
  const margin = args.margin ?? 12
  const gap = args.gap ?? 8
  const maxWidth = args.maxWidth ?? PANEL_MAX_WIDTH_PX
  const top = Math.max(0, Math.round(anchor.bottom + gap))

  // Phones: a full-width sheet under the header reads better than a narrow popover and can never overflow.
  if (viewportWidth < PANEL_SHEET_BELOW_PX) {
    return { top, left: margin, width: Math.max(0, viewportWidth - 2 * margin) }
  }

  // Larger screens: hang from the trigger's right edge, but never wider than the room to its left.
  const right = Math.max(margin, Math.round(viewportWidth - anchor.right))
  const room = viewportWidth - right - margin
  const width = Math.max(Math.min(PANEL_MIN_WIDTH_PX, room), Math.min(maxWidth, room))
  return { top, right, width }
}

/**
 * `left` for a fixed-width panel that should line up with its trigger's right edge, clamped so the panel's both edges
 * stay inside the viewport (a naive `max(8, right - width)` still overflows the RIGHT edge on very narrow screens).
 */
export function rightAlignedPanelLeft(args: {
  anchorRight: number
  panelWidth: number
  viewportWidth: number
  margin?: number
}): number {
  const margin = args.margin ?? 8
  const widest = Math.max(margin, args.viewportWidth - args.panelWidth - margin)
  return Math.round(Math.min(Math.max(margin, args.anchorRight - args.panelWidth), widest))
}
