import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  rules: [] as Array<Record<string, unknown>>,
  plan: [] as Array<Record<string, unknown>>,
  autoRuns: 0,
  used: 0,
  revokeAfter: Infinity,
  reserveBps: null as number | null,
  resellers: ["aff_000001"] as string[],
  applied: [] as string[],
  applyArgs: [] as Array<Record<string, unknown>>,
  notifications: 0,
  txFails: false,
  audit: [] as Array<Record<string, unknown>>,
  listings: [] as Array<{ id: string; affiliateId: string; product: { name: string } }>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?")
      if (sql.includes("DISTINCT")) {
        const [cursor, size] = values as [string, number]
        return state.resellers
          .filter((id) => id > cursor)
          .slice(0, size)
          .map((affiliateId) => ({ affiliateId }))
      }
      if (sql.includes("RETURNING")) {
        // Atomic reservation: grant still active and a slot left, at the moment of use.
        const r = state.rules[0]!
        if (r.revokedAt || state.used >= state.revokeAfter || state.used >= (r.maxRunsPerWeek as number)) return []
        state.used += 1
        return [{ ...r, maxPriceIncreaseBps: state.reserveBps ?? r.maxPriceIncreaseBps, autoRunsInWindow: state.used }]
      }
      return state.rules
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
      if (strings.join("?").includes("GREATEST")) state.used = Math.max(0, state.used - 1)
      return 1
    }),
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => {
      if (state.txFails) throw new Error("audit write failed")
      return Promise.all(ops)
    }),
    auditLog: {
      count: vi.fn(async () => state.autoRuns),
      create: vi.fn(async () => ({})),
      findMany: vi.fn(async ({ where, take }: { where: { action: string; actorId: string }; take?: number }) =>
        state.audit
          .filter((a) => a.action === where.action && a.actorId === where.actorId)
          .sort((x, y) => (y.createdAt as Date).getTime() - (x.createdAt as Date).getTime())
          .slice(0, take ?? Infinity),
      ),
    },
    affiliateProduct: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; affiliateId: string } }) =>
        state.listings.filter((l) => where.id.in.includes(l.id) && l.affiliateId === where.affiliateId),
      ),
    },
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
  applyCopilotAction: vi.fn(async (args: { actionId: string; source: string }) => {
    state.applyArgs.push(args)
    state.applied.push(`${args.actionId}@${args.source}`)
    return { ok: true, auditId: `aud_${state.applied.length}` }
  }),
}))

import { decideAutoApply, parseGrant, type AutonomyRule } from "@/lib/copilot-autonomy"
import {
  grantAutonomy,
  listRecentAutoActions,
  runAutopilot,
  runAutopilotForReseller,
} from "@/lib/copilot-autonomy.server"
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
    state.used = 0
    state.revokeAfter = Infinity
    state.reserveBps = null
    state.resellers = ["aff_000001"]
    state.applied = []
    state.applyArgs = []
    state.notifications = 0
    state.txFails = false
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

  it("a grant revoked DURING the batch stops the next actions (checked at the moment of each use)", async () => {
    state.revokeAfter = 1
    const r = await runAutopilotForReseller("aff_000001")
    expect(state.applied).toEqual(["reprice:lst_000001@auto"])
    expect(r.skipped).toEqual(expect.arrayContaining([{ actionId: "reprice:lst_000005", reason: "weekly_limit" }]))
  })

  it("the limit IN FORCE at the moment of use wins; an unused slot is given back", async () => {
    state.reserveBps = 500 // tightened to +5 % after the batch started: the +8 % suggestion is refused
    const r = await runAutopilotForReseller("aff_000001")
    expect(state.applied).toEqual([])
    expect(r.skipped.filter((s) => s.reason === "price_limit").length).toBeGreaterThanOrEqual(3)
    expect(state.used).toBe(0)
  })

  it("the apply must write EXACTLY the price that was checked against the limit", async () => {
    await runAutopilotForReseller("aff_000001")
    expect(state.applyArgs[0]).toMatchObject({ actionId: "reprice:lst_000001", expectedSuggestedPriceCents: 5400 })
  })

  it("weekly quota is consumed atomically: a second concurrent run gets no slot", async () => {
    const [a, b] = await Promise.all([runAutopilotForReseller("aff_000001"), runAutopilotForReseller("aff_000001")])
    expect(a.applied.length + b.applied.length).toBe(2)
  })

  it("every reseller with a grant is processed, beyond the first page", async () => {
    state.resellers = ["aff_000001", "aff_000002", "aff_000003"]
    state.rules[0]!.maxRunsPerWeek = 50
    const r = await runAutopilot({ env: { COPILOT_AUTOPILOT: "on" }, limit: 1 })
    expect(r.resellers).toBe(3)
  })

  it("a grant whose audit entry cannot be written is not granted (one transaction)", async () => {
    state.txFails = true
    const r = await grantAutonomy({
      affiliateId: "aff_000001",
      rule: { actionType: "reprice", maxPriceIncreaseBps: 1000, maxRunsPerWeek: 5 },
    })
    expect(r).toEqual({ ok: false, reason: "failed" })
  })

  it("the hub lists the copilot's own actions still undoable: not the undone ones, not another reseller's", async () => {
    const at = new Date()
    state.audit = [
      {
        id: "aud_1",
        action: "copilot.apply",
        actorId: "aff_000001",
        entityId: "lst_1",
        payload: { type: "reprice", source: "auto" },
        createdAt: at,
      },
      {
        id: "aud_2",
        action: "copilot.apply",
        actorId: "aff_000001",
        entityId: "lst_2",
        payload: { type: "fix_margins", source: "auto" },
        createdAt: at,
      },
      {
        id: "aud_u",
        action: "copilot.undo",
        actorId: "aff_000001",
        entityId: "lst_2",
        payload: { undoOf: "aud_2" },
        createdAt: at,
      },
      {
        id: "aud_3",
        action: "copilot.apply",
        actorId: "aff_other1",
        entityId: "lst_3",
        payload: { type: "reprice", source: "auto" },
        createdAt: at,
      },
    ]
    state.listings = [
      { id: "lst_1", affiliateId: "aff_000001", product: { name: "Lampe" } },
      { id: "lst_2", affiliateId: "aff_000001", product: { name: "Tapis" } },
      { id: "lst_3", affiliateId: "aff_other1", product: { name: "Autre" } },
    ]
    const rows = await listRecentAutoActions("aff_000001", at)
    expect(rows).toEqual([
      { auditId: "aud_1", type: "reprice", listingId: "lst_1", name: "Lampe", appliedAt: at.toISOString() },
    ])
  })

  it("older automatic actions stay undoable from the hub after the 20 most recent are undone", async () => {
    const t0 = Date.now()
    state.audit = []
    state.listings = []
    for (let i = 0; i < 25; i++) {
      const at = new Date(t0 - i * 60_000)
      state.audit.push({
        id: `aud_${i}`,
        action: "copilot.apply",
        actorId: "aff_000001",
        entityId: `lst_${i}`,
        payload: { type: "reprice", source: "auto" },
        createdAt: at,
      })
      state.listings.push({ id: `lst_${i}`, affiliateId: "aff_000001", product: { name: `P${i}` } })
      if (i < 20)
        state.audit.push({
          id: `undo_${i}`,
          action: "copilot.undo",
          actorId: "aff_000001",
          entityId: `lst_${i}`,
          payload: { undoOf: `aud_${i}` },
          createdAt: at,
        })
    }
    const rows = await listRecentAutoActions("aff_000001", new Date(t0))
    expect(rows.map((r) => r.auditId)).toEqual(["aud_20", "aud_21", "aud_22", "aud_23", "aud_24"])
  })
})
