/**
 * Copilot autonomy — what a reseller allowed the copilot to do ON ITS OWN, per action type. PURE.
 *
 * Levels (per action type, never global):
 *   1. recommend   — information only (every action type, always)
 *   2. confirm     — prepared, applied on the reseller's click, undoable (default for one-click types)
 *   3. auto        — applied by the copilot within the reseller's limits, notified, undoable — ONLY for the types in
 *                    {@link AUTO_ELIGIBLE_TYPES}, ONLY after an explicit grant, revocable at any time.
 *
 * Never automatic, whatever is granted: pausing a listing (visible to buyers, stops sales), anything that moves money,
 * anything irreversible. The database repeats the limits as CHECK constraints (migration reseller_autonomy_rule).
 */
import type { PlannedAction } from "@/lib/reseller-action-plan"

export const AUTO_ELIGIBLE_TYPES = ["fix_margins", "reprice"] as const
export type AutoEligibleType = (typeof AUTO_ELIGIBLE_TYPES)[number]

/** Hard caps, also enforced by the database. */
export const MAX_PRICE_INCREASE_BPS = 2500
export const MAX_RUNS_PER_WEEK = 50
export const DEFAULT_RULE = { maxPriceIncreaseBps: 1000, maxRunsPerWeek: 5 } as const

export type AutonomyRule = {
  actionType: AutoEligibleType
  maxPriceIncreaseBps: number
  maxRunsPerWeek: number
  grantedAt: string
  revokedAt: string | null
}

export function isAutoEligibleType(t: unknown): t is AutoEligibleType {
  return typeof t === "string" && (AUTO_ELIGIBLE_TYPES as readonly string[]).includes(t)
}

export type GrantInput = {
  actionType: unknown
  maxPriceIncreaseBps?: unknown
  maxRunsPerWeek?: unknown
  consent?: unknown
}

/** Validates a grant. The reseller must send `consent: true` — the UI shows the exact limits being granted. */
export function parseGrant(
  input: GrantInput,
):
  | { ok: true; rule: Pick<AutonomyRule, "actionType" | "maxPriceIncreaseBps" | "maxRunsPerWeek"> }
  | { ok: false; error: string } {
  if (input.consent !== true) return { ok: false, error: "consent_required" }
  if (!isAutoEligibleType(input.actionType)) return { ok: false, error: "action_not_automatable" }
  const int = (v: unknown, d: number) => (v === undefined ? d : typeof v === "number" && Number.isInteger(v) ? v : NaN)
  const bps = int(input.maxPriceIncreaseBps, DEFAULT_RULE.maxPriceIncreaseBps)
  const runs = int(input.maxRunsPerWeek, DEFAULT_RULE.maxRunsPerWeek)
  if (!(bps >= 0 && bps <= MAX_PRICE_INCREASE_BPS)) return { ok: false, error: "invalid_price_limit" }
  if (!(runs >= 1 && runs <= MAX_RUNS_PER_WEEK)) return { ok: false, error: "invalid_frequency" }
  return { ok: true, rule: { actionType: input.actionType, maxPriceIncreaseBps: bps, maxRunsPerWeek: runs } }
}

export type AutoDecision =
  | { allowed: true }
  | {
      allowed: false
      reason: "not_granted" | "revoked" | "not_eligible" | "weekly_limit" | "price_limit" | "not_one_click"
    }

/**
 * May this planned action be applied automatically now? `runsLast7Days` = runs already used in the current window
 * (the runner passes 0 once `reserveAutoRun` has taken the slot atomically — the database is the quota authority).
 */
export function decideAutoApply(args: {
  action: PlannedAction
  rule: AutonomyRule | null | undefined
  runsLast7Days: number
}): AutoDecision {
  const { action, rule } = args
  if (!isAutoEligibleType(action.type)) return { allowed: false, reason: "not_eligible" }
  if (action.autonomy !== "one_click") return { allowed: false, reason: "not_one_click" }
  if (!rule || rule.actionType !== action.type) return { allowed: false, reason: "not_granted" }
  if (rule.revokedAt) return { allowed: false, reason: "revoked" }
  if (args.runsLast7Days >= rule.maxRunsPerWeek) return { allowed: false, reason: "weekly_limit" }
  if (action.type === "reprice") {
    const from = action.currentPriceCents ?? 0
    const to = action.suggestedPriceCents ?? 0
    if (!(from > 0 && to > 0)) return { allowed: false, reason: "price_limit" }
    // Integer arithmetic: increase ≤ from × bps / 10 000.
    if ((to - from) * 10_000 > from * rule.maxPriceIncreaseBps) return { allowed: false, reason: "price_limit" }
  }
  return { allowed: true }
}
