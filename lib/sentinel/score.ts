import type { SentinelSeverity } from "@/lib/sentinel/types"

const PENALTY: Record<SentinelSeverity, number> = {
  P0: 18,
  P1: 7,
  P2: 3,
  P3: 1,
}

export function computeSentinelScore(openCounts: Record<SentinelSeverity, number>): number {
  let penalty = 0
  for (const sev of ["P0", "P1", "P2", "P3"] as const) {
    penalty += openCounts[sev] * PENALTY[sev]
  }
  return Math.max(0, Math.min(100, 100 - penalty))
}
