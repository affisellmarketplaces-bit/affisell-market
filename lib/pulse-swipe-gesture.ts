/** Shared Pulse swipe gesture thresholds — client-safe. */

export const PULSE_SWIPE_THRESHOLD_PX = 68
export const PULSE_SWIPE_VELOCITY = 400
/** Require dominant axis to win by this ratio (reduces diagonal mis-fires). */
export const PULSE_SWIPE_AXIS_DOMINANCE = 1.28
/** Pointer movement before locking to horizontal or vertical axis. */
export const PULSE_SWIPE_AXIS_LOCK_PX = 16

export type PulseSwipeAxis = "x" | "y"

export type PulseSwipeDirection = "up" | "down" | "left" | "right"

export function resolveLockedSwipeAxis(
  offset: { x: number; y: number },
  current: PulseSwipeAxis | null
): PulseSwipeAxis | null {
  if (current) return current
  const absX = Math.abs(offset.x)
  const absY = Math.abs(offset.y)
  if (absX < PULSE_SWIPE_AXIS_LOCK_PX && absY < PULSE_SWIPE_AXIS_LOCK_PX) return null
  return absX >= absY * PULSE_SWIPE_AXIS_DOMINANCE
    ? "x"
    : absY >= absX * PULSE_SWIPE_AXIS_DOMINANCE
      ? "y"
      : null
}

export function resolveSwipeDirection(
  offset: { x: number; y: number },
  velocity: { x: number; y: number },
  lockedAxis: PulseSwipeAxis | null
): PulseSwipeDirection | null {
  const absX = Math.abs(offset.x)
  const absY = Math.abs(offset.y)
  if (absX < PULSE_SWIPE_THRESHOLD_PX && absY < PULSE_SWIPE_THRESHOLD_PX) return null

  const axis =
    lockedAxis ??
    (absX >= absY * PULSE_SWIPE_AXIS_DOMINANCE
      ? "x"
      : absY >= absX * PULSE_SWIPE_AXIS_DOMINANCE
        ? "y"
        : null)

  if (axis === "x") {
    if (offset.x > PULSE_SWIPE_THRESHOLD_PX || velocity.x > PULSE_SWIPE_VELOCITY) return "right"
    if (offset.x < -PULSE_SWIPE_THRESHOLD_PX || velocity.x < -PULSE_SWIPE_VELOCITY) return "left"
    return null
  }

  if (axis === "y") {
    if (offset.y < -PULSE_SWIPE_THRESHOLD_PX || velocity.y < -PULSE_SWIPE_VELOCITY) return "up"
    if (offset.y > PULSE_SWIPE_THRESHOLD_PX || velocity.y > PULSE_SWIPE_VELOCITY) return "down"
    return null
  }

  return null
}
