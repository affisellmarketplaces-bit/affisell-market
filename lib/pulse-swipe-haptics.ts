import { buyerHaptic } from "@/lib/buyer-haptics"

/** Light haptic feedback for Pulse swipe commerce — no-op when unsupported. */

export type PulseSwipeHapticKind = "tap" | "commit" | "undo"

const KIND_MAP: Record<PulseSwipeHapticKind, Parameters<typeof buyerHaptic>[0]> = {
  tap: "tap",
  commit: "success",
  undo: "undo",
}

export function pulseSwipeHaptic(kind: PulseSwipeHapticKind): void {
  buyerHaptic(KIND_MAP[kind])
}
