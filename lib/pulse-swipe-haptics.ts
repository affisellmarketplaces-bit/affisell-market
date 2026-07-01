/** Light haptic feedback for Pulse swipe commerce — no-op when unsupported. */

export type PulseSwipeHapticKind = "tap" | "commit" | "undo"

const PATTERNS: Record<PulseSwipeHapticKind, number | number[]> = {
  tap: 10,
  commit: [12, 36, 14],
  undo: [8, 24, 8],
}

export function pulseSwipeHaptic(kind: PulseSwipeHapticKind): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return
  }
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    /* iOS / privacy mode */
  }
}
