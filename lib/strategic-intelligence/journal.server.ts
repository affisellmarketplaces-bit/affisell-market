import "server-only"

import { Prisma } from "@prisma/client"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"
import { gtin14 } from "@/lib/strategic-intelligence/external/safety-gate"
import { loadOrderFacts } from "@/lib/strategic-intelligence/mature-orders.server"
import { orderEconomics } from "@/lib/strategic-intelligence/product-economics"
import {
  familyTrackRecords,
  metricForSignal,
  signalSnapshot,
  summarizeLearning,
  verdictFor,
  type DecisionKind,
  type FamilyRecord,
  type JournalMetric,
  type LearningCell,
  type Measurement,
} from "@/lib/strategic-intelligence/journal"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const MAX_GTIN_ROWS = 150_000

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  const msg = error instanceof Error ? error.message : String(error)
  return code === "P2021" || /does not exist/i.test(msg)
}

/** Measures a journal metric from Affisell's own database (read-only, bounded). */
export async function measureMetric(metric: JournalMetric, scope: string, from: Date, to: Date): Promise<Measurement> {
  if (metric === "affisell_net_cents_per_order") {
    // Same read and same per-order rule as the cockpit's economics (mature-orders.server.ts + orderEconomics).
    if (!scope.startsWith("product:")) throw new Error("journal_bad_scope")
    const orders = await loadOrderFacts({ from, to, productId: scope.slice("product:".length) })
    const nets: number[] = []
    for (const o of orders) {
      const e = orderEconomics(o)
      if (e.usable) nets.push(e.platformNetCents)
    }
    const n = nets.length
    const mean = n > 0 ? nets.reduce((a, b) => a + b, 0) / n : 0
    const sd = n > 1 ? Math.sqrt(nets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
    return { value: Math.round(mean), count: n, base: Math.round(sd), sd }
  }
  if (metric === "paid_orders") {
    const where: Prisma.OrderWhereInput = { paidAt: { gte: from, lt: to } }
    if (scope.startsWith("category:")) where.product = { categoryId: scope.slice("category:".length) }
    else if (scope.startsWith("product:")) where.productId = scope.slice("product:".length)
    else if (scope !== "all") throw new Error("journal_bad_scope")
    const count = await prisma.order.count({ where })
    return { value: count, count, base: null }
  }
  if (metric === "dispute_activity_bps") {
    const [ledger, rows] = await Promise.all([
      prisma.processedWebhook.findMany({ where: { id: { startsWith: "dispute:" }, createdAt: { gte: from, lt: to } }, select: { id: true } }),
      prisma.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(DISTINCT split_part("stripeSessionId", ':line:', 1))::int AS n
        FROM "Order" WHERE "paidAt" >= ${from} AND "paidAt" < ${to}`,
    ])
    const disputes = new Set(ledger.map((r) => r.id.split(":")[1] || r.id)).size
    const payments = Number(rows[0]?.n ?? 0)
    return { value: payments > 0 ? Math.round((disputes / payments) * 10_000) : 0, count: disputes, base: payments }
  }
  // valid_gtin_share_bps — a STATE: measured now, whatever the window.
  const [active, rows] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.productAttribute.findMany({
      where: { key: IDENTITY_KEYS.gtin, product: { active: true } },
      select: { value: true },
      take: MAX_GTIN_ROWS,
    }),
  ])
  if (rows.length >= MAX_GTIN_ROWS) throw new Error("journal_truncated_read")
  const valid = rows.filter((r) => gtin14(r.value)).length
  return { value: active > 0 ? Math.round((valid / active) * 10_000) : 0, count: valid, base: active }
}

export type RecordDecisionResult =
  | { ok: true; id: string; measurable: boolean }
  | { ok: false; error: "decision_already_open" | "journal_unavailable" }

export async function recordDecision(args: {
  signal: StrategicSignal
  decision: DecisionKind
  rationale: string
  measureAfterDays: number | null
  decidedById: string
  now?: Date
  measure?: typeof measureMetric
}): Promise<RecordDecisionResult> {
  const now = args.now ?? new Date()
  const plan = metricForSignal(args.signal.id)
  const measure = args.measure ?? measureMetric
  let measured: Partial<Prisma.IntelligenceDecisionUncheckedCreateInput> = {}
  if (plan) {
    const days = args.measureAfterDays ?? plan.defaultDays
    const maturity = plan.maturityDays ?? 0
    // A metric that needs mature orders: the baseline window ends `maturity` days before the decision.
    const to = new Date(now.getTime() - maturity * DAY_MS)
    const from = new Date(to.getTime() - days * DAY_MS)
    const baseline = await measure(plan.metric, plan.scope, from, to)
    measured = {
      metric: plan.metric,
      metricScope: plan.scope,
      desiredDirection: plan.direction,
      baselineValue: baseline.value,
      baselineCount: baseline.count,
      baselineBase: baseline.base,
      baselineFrom: from,
      baselineTo: to,
      measureAfterDays: days,
      // …and the observed window is measured once its last orders are `maturity` days old too.
      dueAt: new Date(now.getTime() + (days + maturity) * DAY_MS),
    }
  }
  try {
    const row = await prisma.intelligenceDecision.create({
      data: {
        signalId: args.signal.id,
        domain: args.signal.domain,
        signalKind: args.signal.kind,
        title: args.signal.title.slice(0, 500),
        decision: args.decision,
        rationale: args.rationale,
        status: plan ? "open" : "closed",
        decidedById: args.decidedById,
        signalSnapshot: signalSnapshot(args.signal) as Prisma.InputJsonValue,
        createdAt: now,
        ...measured,
      },
      select: { id: true },
    })
    return { ok: true, id: row.id, measurable: Boolean(plan) }
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") return { ok: false, error: "decision_already_open" }
    if (isMissingTable(error)) return { ok: false, error: "journal_unavailable" }
    throw error
  }
}

export type MeasureDecisionResult =
  | { ok: true; outcomeId: string; verdict: string; alreadyMeasured: boolean }
  | { ok: false; error: "not_found" | "not_measurable" | "not_due" | "journal_unavailable" }

/** Measures a due decision ONCE (UNIQUE decisionId): same metric, window of the same length right after the decision. */
export async function measureDecision(
  decisionId: string,
  opts: { measuredById: string | null; now?: Date; measure?: typeof measureMetric }
): Promise<MeasureDecisionResult> {
  const now = opts.now ?? new Date()
  const measure = opts.measure ?? measureMetric
  try {
    const d = await prisma.intelligenceDecision.findUnique({ where: { id: decisionId } })
    if (!d) return { ok: false, error: "not_found" }
    const existing = await prisma.intelligenceOutcome.findUnique({ where: { decisionId }, select: { id: true, verdict: true } })
    if (existing) return { ok: true, outcomeId: existing.id, verdict: existing.verdict, alreadyMeasured: true }
    if (!d.metric || !d.dueAt || d.baselineValue == null || !d.measureAfterDays || !d.desiredDirection) return { ok: false, error: "not_measurable" }
    if (now < d.dueAt) return { ok: false, error: "not_due" }
    const metric = d.metric as JournalMetric
    const windowFrom = d.createdAt
    const windowTo = new Date(d.createdAt.getTime() + d.measureAfterDays * DAY_MS)
    const observed = await measure(metric, d.metricScope ?? "all", windowFrom, windowTo)
    const result = verdictFor(
      metric,
      d.desiredDirection as "up" | "down",
      { value: d.baselineValue, count: d.baselineCount ?? 0, base: d.baselineBase },
      observed
    )
    try {
      const [outcome] = await prisma.$transaction([
        prisma.intelligenceOutcome.create({
          data: {
            decisionId,
            metric,
            observedValue: observed.value,
            observedCount: observed.count,
            observedBase: observed.base,
            windowFrom,
            windowTo: metric === "valid_gtin_share_bps" ? (now > windowFrom ? now : windowTo) : windowTo,
            zScore: result.z,
            verdict: result.verdict,
            method: result.reason,
            measuredById: opts.measuredById,
            measuredAt: now,
          },
          select: { id: true, verdict: true },
        }),
        prisma.intelligenceDecision.updateMany({ where: { id: decisionId, status: "open" }, data: { status: "measured" } }),
      ])
      return { ok: true, outcomeId: outcome.id, verdict: outcome.verdict, alreadyMeasured: false }
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002") {
        const again = await prisma.intelligenceOutcome.findUnique({ where: { decisionId }, select: { id: true, verdict: true } })
        if (again) return { ok: true, outcomeId: again.id, verdict: again.verdict, alreadyMeasured: true }
      }
      throw error
    }
  } catch (error) {
    if (isMissingTable(error)) return { ok: false, error: "journal_unavailable" }
    throw error
  }
}

export type JournalEntry = {
  id: string
  signalId: string
  domain: string
  title: string
  decision: string
  rationale: string
  metric: string | null
  desiredDirection: string | null
  baselineValue: number | null
  measureAfterDays: number | null
  dueAt: string | null
  status: string
  createdAt: string
  outcome: { verdict: string; observedValue: number; method: string; measuredAt: string } | null
}

export type JournalView = {
  available: boolean
  entries: JournalEntry[]
  learning: LearningCell[]
  latestBySignal: Record<string, JournalEntry>
  byFamily: Record<string, FamilyRecord>
}

/** Defensive: a missing table (migration not applied) = an empty journal, flagged unavailable. */
export async function loadJournal(limit = 200): Promise<JournalView> {
  try {
    const decisions = await prisma.intelligenceDecision.findMany({ orderBy: { createdAt: "desc" }, take: limit })
    const outcomes = decisions.length
      ? await prisma.intelligenceOutcome.findMany({ where: { decisionId: { in: decisions.map((d) => d.id) } } })
      : []
    const byDecision = new Map(outcomes.map((o) => [o.decisionId, o]))
    const entries: JournalEntry[] = decisions.map((d) => {
      const o = byDecision.get(d.id)
      return {
        id: d.id,
        signalId: d.signalId,
        domain: d.domain,
        title: d.title,
        decision: d.decision,
        rationale: d.rationale,
        metric: d.metric,
        desiredDirection: d.desiredDirection,
        baselineValue: d.baselineValue,
        measureAfterDays: d.measureAfterDays,
        dueAt: d.dueAt?.toISOString() ?? null,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        outcome: o ? { verdict: o.verdict, observedValue: o.observedValue, method: o.method, measuredAt: o.measuredAt.toISOString() } : null,
      }
    })
    const latestBySignal: Record<string, JournalEntry> = {}
    for (const e of entries) if (!latestBySignal[e.signalId]) latestBySignal[e.signalId] = e
    const learning = summarizeLearning(
      entries
        .filter((e) => e.outcome)
        .map((e) => ({ decision: e.decision as DecisionKind, domain: e.domain, verdict: e.outcome!.verdict as "improved" | "worsened" | "inconclusive" }))
    )
    const byFamily = familyTrackRecords(
      entries
        .filter((e) => e.outcome)
        .map((e) => ({ signalId: e.signalId, decision: e.decision as DecisionKind, verdict: e.outcome!.verdict as "improved" | "worsened" | "inconclusive" }))
    )
    return { available: true, entries, learning, latestBySignal, byFamily }
  } catch (error) {
    if (isMissingTable(error)) return { available: false, entries: [], learning: [], latestBySignal: {}, byFamily: {} }
    throw error
  }
}
