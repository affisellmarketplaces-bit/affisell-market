import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const db = vi.hoisted(() => ({ created: [] as Array<Record<string, unknown>>, decision: null as Record<string, unknown> | null, outcomes: [] as Array<Record<string, unknown>> }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    intelligenceDecision: {
      create: async ({ data }: { data: Record<string, unknown> }) => (db.created.push(data), { id: "d1" }),
      findUnique: async () => db.decision,
      updateMany: async () => ({ count: 1 }),
    },
    intelligenceOutcome: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => (db.outcomes.push(data), { id: "o1", verdict: data.verdict }),
    },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  },
}))

import { MARGIN_MATURITY_DAYS, metricForSignal, verdictFor, welchZ } from "@/lib/strategic-intelligence/journal"
import { measureDecision, recordDecision, type measureMetric } from "@/lib/strategic-intelligence/journal.server"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const DAY = 86_400_000
const signal = { id: "commercial:economics:populaire_non_rentable:p1", domain: "commercial", kind: "estimate", title: "T", evidence: [], source: { id: "x", query: "q" }, observedAt: "", window: null, confidence: "medium", confidenceReason: "", recommendedAction: "", link: null, priority: "important" } as unknown as StrategicSignal

beforeEach(() => {
  db.created = []
  db.outcomes = []
  db.decision = null
})

describe("decisions on loss-making products are measured on Affisell's margin per MATURE order", () => {
  it("maps the three loss classes, product scope, upward", () => {
    for (const c of ["populaire_non_rentable", "a_abandonner", "marge_ameliorable_sourcing"])
      expect(metricForSignal(`commercial:economics:${c}:p1`)).toEqual({ metric: "affisell_net_cents_per_order", scope: "product:p1", direction: "up", defaultDays: 30, maturityDays: MARGIN_MATURITY_DAYS })
  })

  it("baseline = mature orders BEFORE the decision; due once the observed orders are as mature", async () => {
    const now = new Date("2026-11-17T00:00:00Z")
    const calls: Array<[string, string, Date, Date]> = []
    const measure = (async (m: string, s: string, f: Date, t: Date) => (calls.push([m, s, f, t]), { value: -120, count: 14, base: 80, sd: 80 })) as unknown as typeof measureMetric
    await recordDecision({ signal, decision: "act", rationale: "revoir la source", measureAfterDays: 30, decidedById: "admin", now, measure })
    const [, scope, from, to] = calls[0]!
    expect(scope).toBe("product:p1")
    expect((now.getTime() - to.getTime()) / DAY).toBe(21)
    expect((to.getTime() - from.getTime()) / DAY).toBe(30)
    const row = db.created[0]!
    expect(row).toMatchObject({ metric: "affisell_net_cents_per_order", baselineValue: -120, baselineCount: 14, baselineBase: 80 })
    expect(((row.dueAt as Date).getTime() - now.getTime()) / DAY).toBe(30 + 21)
  })

  it("the observed window is the 30 days AFTER the decision; not measured before it is mature", async () => {
    const createdAt = new Date("2026-10-01T00:00:00Z")
    db.decision = { id: "d1", createdAt, metric: "affisell_net_cents_per_order", metricScope: "product:p1", desiredDirection: "up", baselineValue: -120, baselineCount: 14, baselineBase: 80, measureAfterDays: 30, dueAt: new Date(createdAt.getTime() + 51 * DAY) }
    const calls: Array<[Date, Date]> = []
    const measure = (async (_m: string, _s: string, f: Date, t: Date) => (calls.push([f, t]), { value: 90, count: 16, base: 70, sd: 70 })) as unknown as typeof measureMetric
    expect(await measureDecision("d1", { measuredById: null, now: new Date(createdAt.getTime() + 40 * DAY), measure })).toEqual({ ok: false, error: "not_due" })
    const r = await measureDecision("d1", { measuredById: null, now: new Date(createdAt.getTime() + 52 * DAY), measure })
    expect(r).toMatchObject({ ok: true, verdict: "improved" })
    expect(calls[0]![0].getTime()).toBe(createdAt.getTime())
    expect((calls[0]![1].getTime() - createdAt.getTime()) / DAY).toBe(30)
    expect(String(db.outcomes[0]!.method)).toMatch(/pas la preuve que l'action en est la cause/)
  })
})

describe("the verdict is a difference of means beyond chance", () => {
  const m = "affisell_net_cents_per_order" as const
  it("Welch z", () => {
    expect(welchZ(0, 10, 25, 4, 10, 25)).toBeCloseTo(4 / Math.sqrt(8), 10)
  })
  it("too few mature orders → inconclusive", () => {
    expect(verdictFor(m, "up", { value: -100, count: 9, base: 50 }, { value: 200, count: 30, base: 50 }).verdict).toBe("inconclusive")
  })
  it("a small move inside the noise → inconclusive; a clear one → improved / worsened", () => {
    expect(verdictFor(m, "up", { value: -100, count: 20, base: 300 }, { value: -50, count: 20, base: 300 }).verdict).toBe("inconclusive")
    expect(verdictFor(m, "up", { value: -100, count: 20, base: 50 }, { value: 50, count: 20, base: 50 }).verdict).toBe("improved")
    expect(verdictFor(m, "up", { value: 100, count: 20, base: 50 }, { value: -50, count: 20, base: 50 }).verdict).toBe("worsened")
  })
})
