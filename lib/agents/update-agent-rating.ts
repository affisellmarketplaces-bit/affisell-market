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
