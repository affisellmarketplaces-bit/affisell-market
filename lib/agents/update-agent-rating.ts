/** Min/max agent rating (×10 scale: 47 = 4.7★). */
export const AGENT_RATING_MIN_X10 = 30
export const AGENT_RATING_MAX_X10 = 50

export type AgentMissionOutcome = "PASSED" | "FAILED"

/**
 * Adjust rating after a terminal mission outcome.
 * PASSED +1, FAILED −2, clamped to [3.0★, 5.0★].
 */
export function adjustAgentRatingX10(
  currentRatingX10: number,
  outcome: AgentMissionOutcome
): number {
  const base = Number.isFinite(currentRatingX10) ? Math.round(currentRatingX10) : 45
  const delta = outcome === "PASSED" ? 1 : -2
  return Math.min(AGENT_RATING_MAX_X10, Math.max(AGENT_RATING_MIN_X10, base + delta))
}

/**
 * Rolling SLA: blend previous leadTimeHours with actual turnaround (assigned → completed).
 */
export function adjustAgentLeadTimeHours(
  currentLeadTimeHours: number,
  assignedAt: Date,
  completedAt: Date
): number {
  const prev = Number.isFinite(currentLeadTimeHours) ? Math.round(currentLeadTimeHours) : 48
  const ms = completedAt.getTime() - assignedAt.getTime()
  const actualHours = Math.max(1, Math.min(168, Math.round(ms / (60 * 60 * 1000))))
  return Math.max(4, Math.min(168, Math.round(prev * 0.7 + actualHours * 0.3)))
}
