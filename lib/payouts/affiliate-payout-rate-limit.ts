const rateLimitMap = new Map<string, number[]>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

/** In-process rate limit — 10 POST/min per affiliate (best-effort on serverless). */
export function checkAffiliatePayoutRateLimit(affiliateId: string): boolean {
  const now = Date.now()
  const window = rateLimitMap.get(affiliateId) ?? []
  const filtered = window.filter((t) => now - t < WINDOW_MS)
  if (filtered.length >= MAX_REQUESTS) return false
  filtered.push(now)
  rateLimitMap.set(affiliateId, filtered)
  return true
}
