export const EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT = 50

export function shouldAutoPauseLaunchNotify(args: {
  deliveredThisMonth: number
  notifiedCount: number
  thresholdPct?: number
  minNotified?: number
}): boolean {
  const thresholdPct = args.thresholdPct ?? EXPANSION_AUTO_PAUSE_DELIVERY_THRESHOLD_PCT
  const minNotified = args.minNotified ?? 10
  if (args.notifiedCount < minNotified) return false
  if (args.deliveredThisMonth === 0) return true
  return (
    Math.min(
      100,
      Math.round((args.deliveredThisMonth / args.notifiedCount) * 1000) / 10
    ) < thresholdPct
  )
}
