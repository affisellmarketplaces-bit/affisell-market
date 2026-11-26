import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  rules: [] as Array<Record<string, unknown>>,
  plan: [] as Array<Record<string, unknown>>,
  autoRuns: 0,
  applied: [] as string[],
  notifications: 0,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) =>
      strings.join("?").includes("DISTINCT") ? [{ affiliateId: "aff_000001" }] : state.rules,
    ),
    $executeRaw: vi.fn(async () => 1),
    auditLog: { count: vi.fn(async () => state.autoRuns), create: vi.fn(async () => ({})) },
    notification: {
      create: vi.fn(async () => {
        state.notifications += 1
        return {}
      }),
    },
  },
}))
vi.mock("@/lib/reseller-action-plan.server", () => ({
  loadResellerActionPlan: vi.fn(async () => ({ actions: state.plan, listingsChecked: 1, estimated: true })),
  applyCopilotAction: vi.fn(async ({ actionId, source }: { actionId: string; source: string }) => {
    state.applied.push(`${actionId}@${source}`)
    return { ok: true, auditId: `aud_${state.applied.length}` }
  }),
}))

import { decideAutoApply, parseGrant, type AutonomyRule } from "@/lib/copilot-autonomy"
import { runAutopilot, runAutopilotForReseller } from "@/lib/copilot-autonomy.server"
import type { PlannedAction } from "@/lib/reseller-action-plan"

const action = (over: Partial<PlannedAction>): PlannedAction => ({
  id: "reprice:lst_000001",
  type: "reprice",
  autonomy: "one_click",
  reversible: true,
  listingId: "lst_000001",
  productId: "prod_000001",
  name: "Lampe",
  reasons: ["net_thin"],
  currentPriceCents: 5000,
  suggestedPriceCents: 5400,
  impactCents: 100,
  estimated: true,
  ...over,
})
const rule = (over: Partial<AutonomyRule> = {}): AutonomyRule => ({
  actionType: "reprice",
  maxPriceIncreaseBps: 1000,
  maxRunsPerWeek: 5,
  grantedAt: "2026-11-01T00:00:00.000Z",
  revokedAt: null,
  ...over,
})

describe("grants — explicit, per type, bounded", () => {
  it("requires consent and an automatable type; there is no 'all' or 'pause' grant", () => {
    expect(parseGrant({ actionType: "reprice" })).toEqual({ ok: false, error: "consent_required" })
    expect(parseGrant({ actionType: "pause", consent: true })).toEqual({ ok: false, error: "action_not_automatable" })
    expect(parseGrant({ actionType: "all", consent: true })).toEqual({ ok: false, error: "action_not_automatable" })
    expect(parseGrant({ actionType: "reprice", consent: true, maxPriceIncreaseBps: 3000 })).toEqual({
      ok: false,
      error: "invalid_price_limit",
    })
    expect(parseGrant({ actionType: "reprice", consent: true, maxRunsPerWeek: 0 })).toEqual({
      ok: false,
      error: "invalid_frequency",
    })
    expect(parseGrant({ actionType: "fix_margins", consent: true })).toEqual({
      ok: true,
      rule: { actionType: "fix_margins", maxPriceIncreaseBps: 1000, maxRunsPerWeek: 5 },
    })
  })

  it("decision: type granted, not revoked, under the weekly cap and the price cap", () => {
    expect(decideAutoApply({ action: action({}), rule: rule(), runsLast7Days: 0 })).toEqual({ allowed: true })
    expect(decideAutoApply({ action: action({}), rule: null, runsLast7Days: 0 })).toEqual({
      allowed: false,
      reason: "not_granted",
    })
    expect(
      decideAutoApply({ action: action({}), rule: rule({ revokedAt: "2026-11-02T00:00:00.000Z" }), runsLast7Days: 0 }),
    ).toEqual({
      allowed: false,
      reason: "revoked",
    })
    expect(decideAutoApply({ action: action({}), rule: rule(), runsLast7Days: 5 })).toEqual({
      allowed: false,
      reason: "weekly_limit",
    })
    // +8 % allowed under 10 %; +12 % refused.
    expect(decideAutoApply({ action: action({ suggestedPriceCents: 5600 }), rule: rule(), runsLast7Days: 0 })).toEqual({
      allowed: false,
      reason: "price_limit",
    })
    expect(
      decideAutoApply({ action: action({ suggestedPriceCents: 5500 }), rule: rule(), runsLast7Days: 0 }).allowed,
    ).toBe(true)
  })

  it("never automatic: pause, recommendations, and a grant for another type", () => {
    expect(
      decideAutoApply({ action: action({ type: "pause", id: "pause:lst_000001" }), rule: rule(), runsLast7Days: 0 }),
    ).toEqual({
      allowed: false,
      reason: "not_eligible",
    })
    expect(decideAutoApply({ action: action({ autonomy: "recommend" }), rule: rule(), runsLast7Days: 0 })).toEqual({
      allowed: false,
      reason: "not_one_click",
    })
    expect(
      decideAutoApply({ action: action({}), rule: rule({ actionType: "fix_margins" }), runsLast7Days: 0 }),
    ).toEqual({
      allowed: false,
      reason: "not_granted",
    })
  })
})

describe("autopilot runner", () => {
  beforeEach(() => {
    state.rules = [
      { actionType: "reprice", maxPriceIncreaseBps: 1000, maxRunsPerWeek: 2, grantedAt: new Date(), revokedAt: null },
    ]
    state.plan = [
      action({ id: "reprice:lst_000001" }),
      action({ id: "reprice:lst_000002", listingId: "lst_000002", suggestedPriceCents: 9000 }), // +80 %: over the cap
      action({ id: "pause:lst_000003", type: "pause", listingId: "lst_000003" }),
      action({ id: "fix_margins:lst_000004", type: "fix_margins", listingId: "lst_000004" }), // not granted
      action({ id: "reprice:lst_000005", listingId: "lst_000005" }),
      action({ id: "reprice:lst_000006", listingId: "lst_000006" }),
    ]
    state.autoRuns = 0
    state.applied = []
    state.notifications = 0
  })

  it("applies only what the grant allows, through the guarded path, notifies each, stops at the weekly cap", async () => {
    const r = await runAutopilotForReseller("aff_000001")
    expect(state.applied).toEqual(["reprice:lst_000001@auto", "reprice:lst_000005@auto"])
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { actionId: "reprice:lst_000002", reason: "price_limit" },
        { actionId: "reprice:lst_000006", reason: "weekly_limit" },
      ]),
    )
    expect(r.skipped.some((s) => s.actionId.startsWith("pause:") || s.actionId.startsWith("fix_margins:"))).toBe(false)
    expect(state.notifications).toBe(2)
  })

  it("revoked grant = nothing applied", async () => {
    state.rules = [{ ...state.rules[0], revokedAt: new Date() }]
    expect((await runAutopilotForReseller("aff_000001")).applied).toEqual([])
  })

  it("kill switch: off unless COPILOT_AUTOPILOT=on", async () => {
    expect(await runAutopilot({ env: {} })).toEqual({ enabled: false, resellers: 0, applied: 0 })
    expect(state.applied).toEqual([])
    expect((await runAutopilot({ env: { COPILOT_AUTOPILOT: "on" } })).applied).toBe(2)
  })
})
