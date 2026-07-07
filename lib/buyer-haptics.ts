/** Tactile feedback for buyer conversion actions — no-op when unsupported. */

export type BuyerHapticKind =
  | "tap"
  | "success"
  | "undo"
  | "wishlistAdd"
  | "wishlistRemove"
  | "cartAdd"

const PATTERNS: Record<BuyerHapticKind, number | number[]> = {
  tap: 10,
  success: [12, 36, 14],
  undo: [8, 24, 8],
  wishlistAdd: [10, 32, 12],
  wishlistRemove: 8,
  cartAdd: [14, 42, 16],
}

function canVibrate(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false
  if (typeof window === "undefined") return false
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  return true
}

export function buyerHaptic(kind: BuyerHapticKind): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    /* iOS Safari / privacy mode */
  }
}
