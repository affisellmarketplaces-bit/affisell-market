/** Client-side rate limit: max N Veo predict calls per rolling minute. */
export class VeoRateLimiter {
  private readonly timestamps: number[] = []

  constructor(
    private readonly maxPerMinute: number,
    private readonly windowMs = 60_000
  ) {}

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now()
      while (this.timestamps.length > 0 && now - this.timestamps[0]! >= this.windowMs) {
        this.timestamps.shift()
      }
      if (this.timestamps.length < this.maxPerMinute) {
        this.timestamps.push(now)
        return
      }
      const waitMs = this.windowMs - (now - this.timestamps[0]!) + 50
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 5_000)))
    }
  }
}

const globalLimiter = new VeoRateLimiter(
  Math.max(1, Number(process.env.VEO_RATE_LIMIT_PER_MINUTE ?? 10) || 10)
)

export function acquireVeoRateLimit(): Promise<void> {
  return globalLimiter.acquire()
}
