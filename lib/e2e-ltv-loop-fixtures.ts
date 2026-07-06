import { shouldUseE2ePulseFixtures } from "@/lib/e2e-pulse-swipe-fixtures"

export function shouldUseE2eLtvLoopFixtures(query: {
  e2eFixtures?: string | null
}): boolean {
  return shouldUseE2ePulseFixtures(query)
}

export function parseE2eCreatorsWatchingOverride(
  raw: string | undefined,
  enabled: boolean
): number | null {
  if (!enabled || !raw?.trim()) return null
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
