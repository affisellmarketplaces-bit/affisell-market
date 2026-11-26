/**
 * Did the advice work? — PURE before/after evaluation of each action the reseller applied from the copilot.
 *
 * For an action applied at T on a listing, compare what that listing actually EARNED (amounts due on paid orders,
 * see `copilot-accuracy.ts`) per day in the {@link OUTCOME_WINDOW_DAYS} days before and after T:
 *
 * - `too_early`         the after-window is not over yet;
 * - `insufficient_data` fewer than {@link OUTCOME_MIN_ORDERS} orders in a window — no verdict;
 * - `beneficial` / `unfavourable` earnings per day moved by ≥ {@link OUTCOME_MIN_CHANGE} (up / down);
 * - `neutral`           in between.
 *
 * A pause is judged on what it stopped: the listing's earnings per sale in the before-window (≤ 0 → it stopped a
 * loss → beneficial; clearly positive → unfavourable). This is an OBSERVATION, not causal proof (the market moves
 * too), shown as such; the track record per action type × category is what the copilot "learns" — counts, no model.
 */
export const OUTCOME_WINDOW_DAYS = 28
export const OUTCOME_MIN_ORDERS = 5
export const OUTCOME_MIN_CHANGE = 0.1
/** Below this many evaluated actions, a track record is not shown as a rate. */
export const TRACK_RECORD_MIN = 10

export type OutcomeVerdict = "beneficial" | "neutral" | "unfavourable" | "insufficient_data" | "too_early"

export type OrderEarning = { paidAt: Date; dueCents: number }

export type ActionOutcome = {
  verdict: OutcomeVerdict
  before: { orders: number; earnedCents: number; perDayCents: number }
  after: { orders: number; earnedCents: number; perDayCents: number } | null
  change: number | null
  observation: true
}

const DAY = 86_400_000

function windowStats(orders: readonly OrderEarning[], from: Date, to: Date) {
  const inWin = orders.filter((o) => o.paidAt >= from && o.paidAt < to)
  const earned = inWin.reduce((a, o) => a + o.dueCents, 0)
  const days = Math.max(1, (to.getTime() - from.getTime()) / DAY)
  return { orders: inWin.length, earnedCents: earned, perDayCents: Math.round(earned / days) }
}

export function evaluateActionOutcome(args: {
  type: string
  appliedAt: Date
  orders: readonly OrderEarning[]
  now?: Date
}): ActionOutcome {
  const now = args.now ?? new Date()
  const T = args.appliedAt.getTime()
  const before = windowStats(args.orders, new Date(T - OUTCOME_WINDOW_DAYS * DAY), args.appliedAt)

  if (args.type === "pause") {
    if (before.orders < OUTCOME_MIN_ORDERS)
      return { verdict: "insufficient_data", before, after: null, change: null, observation: true }
    const perSale = before.earnedCents / before.orders
    const verdict: OutcomeVerdict = perSale <= 0 ? "beneficial" : perSale >= 100 ? "unfavourable" : "neutral"
    return { verdict, before, after: null, change: null, observation: true }
  }

  const afterEnd = new Date(T + OUTCOME_WINDOW_DAYS * DAY)
  if (afterEnd > now) return { verdict: "too_early", before, after: null, change: null, observation: true }
  const after = windowStats(args.orders, args.appliedAt, afterEnd)
  if (before.orders < OUTCOME_MIN_ORDERS || after.orders < OUTCOME_MIN_ORDERS) {
    return { verdict: "insufficient_data", before, after, change: null, observation: true }
  }
  const change =
    before.perDayCents !== 0 ? (after.perDayCents - before.perDayCents) / Math.abs(before.perDayCents) : null
  const verdict: OutcomeVerdict =
    change == null
      ? after.perDayCents > 0
        ? "beneficial"
        : "neutral"
      : change >= OUTCOME_MIN_CHANGE
        ? "beneficial"
        : change <= -OUTCOME_MIN_CHANGE
          ? "unfavourable"
          : "neutral"
  return { verdict, before, after, change, observation: true }
}

export type TrackRecord = {
  key: string
  evaluated: number
  beneficial: number
  neutral: number
  unfavourable: number
  /** Share of beneficial among evaluated; null below {@link TRACK_RECORD_MIN}. */
  successRate: number | null
}

/** What has worked, per action type × segment — plain counts the copilot can show next to a new suggestion. */
export function trackRecords(outcomes: ReadonlyArray<{ key: string; verdict: OutcomeVerdict }>): TrackRecord[] {
  const map = new Map<string, TrackRecord>()
  for (const o of outcomes) {
    if (o.verdict === "too_early" || o.verdict === "insufficient_data") continue
    const r = map.get(o.key) ?? {
      key: o.key,
      evaluated: 0,
      beneficial: 0,
      neutral: 0,
      unfavourable: 0,
      successRate: null,
    }
    r.evaluated += 1
    r[o.verdict] += 1
    map.set(o.key, r)
  }
  return [...map.values()]
    .map((r) => ({ ...r, successRate: r.evaluated >= TRACK_RECORD_MIN ? r.beneficial / r.evaluated : null }))
    .sort((a, b) => b.evaluated - a.evaluated || a.key.localeCompare(b.key))
}
