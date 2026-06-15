export type LaunchBounceRowState = {
  launchNotifiedAt: Date | null
  launchEmailBouncedAt: Date | null
  launchEmailSuppressedAt: Date | null
}

export type LaunchBounceAction = "requeue" | "suppress" | "ignore"

/** First hard bounce → one retry; second bounce after re-notify → permanent suppress. */
export function resolveLaunchBounceAction(row: LaunchBounceRowState): LaunchBounceAction {
  if (row.launchEmailSuppressedAt) return "ignore"
  if (row.launchNotifiedAt && row.launchEmailBouncedAt) return "suppress"
  if (row.launchNotifiedAt && !row.launchEmailBouncedAt) return "requeue"
  return "ignore"
}

export type LaunchBounceHandleResult = {
  requeued: number
  suppressed: number
}

export function mergeLaunchBounceHandleResult(
  current: LaunchBounceHandleResult,
  action: LaunchBounceAction
): LaunchBounceHandleResult {
  if (action === "requeue") return { ...current, requeued: current.requeued + 1 }
  if (action === "suppress") return { ...current, suppressed: current.suppressed + 1 }
  return current
}
