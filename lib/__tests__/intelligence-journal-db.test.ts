/**
 * Decision journal on a REAL PostgreSQL (migration 20261117150000_intelligence_decision_journal). The guarantees that
 * make the learning loop honest live in the database: one OPEN decision per signal (partial unique index), one
 * measurement per decision (UNIQUE), a measurable decision always carries its server-measured baseline (CHECK). The CI
 * schema comes from the datamodel (no CHECK, no partial index), so the test drops the two tables and applies the
 * migration's own SQL, twice (idempotent). The metric reader is injected (its own queries are plain counts).
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import type { Measurement } from "@/lib/strategic-intelligence/journal"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

function statements(sql: string): string[] {
  return sql
    .replace(/^--.*$/gm, "")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261117150000_intelligence_decision_journal/migration.sql")
const stamp = Date.now()
const now = new Date("2026-11-17T08:00:00.000Z")

const signal = (id: string): StrategicSignal => ({
  id,
  domain: "market_observatory",
  priority: "important",
  kind: "fact",
  title: "Demande en baisse sur Affisell : « Lampes »",
  evidence: [{ label: "Commandes payées, 30 derniers jours", value: "10" }],
  source: { id: "affisell.orders.categories", query: "q" },
  observedAt: now.toISOString(),
  window: null,
  confidence: "high",
  confidenceReason: "r",
  recommendedAction: "a",
  link: null,
})

describe.skipIf(!RUN_DB)("decision journal — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let journal: typeof import("@/lib/strategic-intelligence/journal.server")
  const sig = `market:category:fall:cat-${stamp}`

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    journal = await import("@/lib/strategic-intelligence/journal.server")
    for (const t of ["IntelligenceDecision", "IntelligenceOutcome"]) await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`)
    const parts = statements(readFileSync(MIGRATION, "utf8"))
    expect(parts.length).toBe(6)
    for (let round = 0; round < 2; round++) for (const s of parts) await prisma.$executeRawUnsafe(s)
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.$disconnect()
  })

  it("records a measurable decision with the SERVER's baseline; a second open decision on the same signal is refused", async () => {
    const measure = vi.fn(async (): Promise<Measurement> => ({ value: 40, count: 40, base: null }))
    const first = await journal.recordDecision({ signal: signal(sig), decision: "act", rationale: "Relance", measureAfterDays: 14, decidedById: "admin", now, measure })
    expect(first).toMatchObject({ ok: true, measurable: true })
    expect(measure).toHaveBeenCalledWith("paid_orders", `category:cat-${stamp}`, new Date(now.getTime() - 14 * DAY_MS), now)
    const row = await prisma.intelligenceDecision.findUniqueOrThrow({ where: { id: (first as { id: string }).id } })
    expect(row).toMatchObject({ status: "open", metric: "paid_orders", baselineValue: 40, measureAfterDays: 14, desiredDirection: "up" })
    expect(row.dueAt?.toISOString()).toBe(new Date(now.getTime() + 14 * DAY_MS).toISOString())
    const again = await journal.recordDecision({ signal: signal(sig), decision: "watch", rationale: "Bis", measureAfterDays: null, decidedById: "admin", now, measure })
    expect(again).toEqual({ ok: false, error: "decision_already_open" })
  })

  it("measures once, only when due; concurrent measurements give ONE outcome", async () => {
    const d = await prisma.intelligenceDecision.findFirstOrThrow({ where: { signalId: sig } })
    const measure = vi.fn(async (): Promise<Measurement> => ({ value: 15, count: 15, base: null }))
    expect(await journal.measureDecision(d.id, { measuredById: "admin", now, measure })).toEqual({ ok: false, error: "not_due" })
    const later = new Date(now.getTime() + 15 * DAY_MS)
    const runs = await Promise.all(Array.from({ length: 4 }, () => journal.measureDecision(d.id, { measuredById: "admin", now: later, measure })))
    for (const r of runs) expect(r).toMatchObject({ ok: true, verdict: "worsened" }) // 40 → 15 with goal "up"
    expect(await prisma.intelligenceOutcome.count({ where: { decisionId: d.id } })).toBe(1)
    expect((await prisma.intelligenceDecision.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("measured")
    // The window measured is the one right after the decision, whatever the day the measure is run.
    expect(measure).toHaveBeenCalledWith("paid_orders", `category:cat-${stamp}`, d.createdAt, new Date(d.createdAt.getTime() + 14 * DAY_MS))
    // Once measured, a NEW decision on the same signal can be opened.
    const next = await journal.recordDecision({ signal: signal(sig), decision: "experiment", rationale: "Deuxième essai", measureAfterDays: null, decidedById: "admin", now: later, measure })
    expect(next).toMatchObject({ ok: true })
  })

  it("a signal without a metric is recorded as closed, never 'measured'", async () => {
    const r = await journal.recordDecision({ signal: signal(`supplier:fx:USD:weaker:${stamp}`), decision: "watch", rationale: "On attend", measureAfterDays: null, decidedById: "admin", now })
    expect(r).toMatchObject({ ok: true, measurable: false })
    const row = await prisma.intelligenceDecision.findUniqueOrThrow({ where: { id: (r as { id: string }).id } })
    expect(row).toMatchObject({ status: "closed", metric: null, dueAt: null })
    expect(await journal.measureDecision(row.id, { measuredById: "admin", now })).toEqual({ ok: false, error: "not_measurable" })
  })

  it("the tables refuse what the code must never write", async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO "IntelligenceDecision" ("id","signalId","domain","signalKind","title","decision","rationale","status","decidedById","signalSnapshot") VALUES (${`a${stamp}`}, 's', 'd', 'fact', 't', 'buy', 'because', 'closed', 'admin', '{}'::jsonb)`
    ).rejects.toThrow() // unknown decision
    await expect(
      prisma.$executeRaw`INSERT INTO "IntelligenceDecision" ("id","signalId","domain","signalKind","title","decision","rationale","metric","status","decidedById","signalSnapshot") VALUES (${`b${stamp}`}, 's', 'd', 'fact', 't', 'act', 'because', 'paid_orders', 'open', 'admin', '{}'::jsonb)`
    ).rejects.toThrow() // a metric without its server-measured baseline
    await expect(
      prisma.$executeRaw`INSERT INTO "IntelligenceDecision" ("id","signalId","domain","signalKind","title","decision","rationale","status","decidedById","signalSnapshot") VALUES (${`c${stamp}`}, 's', 'd', 'fact', 't', 'act', 'because', 'open', 'admin', '{}'::jsonb)`
    ).rejects.toThrow() // open without anything to measure
    await expect(
      prisma.$executeRaw`INSERT INTO "IntelligenceOutcome" ("id","decisionId","metric","observedValue","windowFrom","windowTo","verdict","method") VALUES (${`o${stamp}`}, 'x', 'paid_orders', 1, now(), now() + interval '1 day', 'no_effect', 'm')`
    ).rejects.toThrow() // "no effect" is not a verdict the data can give
  })

  it("loadJournal shows the latest decision per signal and learns only from measured results", async () => {
    const view = await journal.loadJournal()
    expect(view.available).toBe(true)
    expect(view.latestBySignal[sig]).toMatchObject({ decision: "experiment" })
    expect(view.learning).toEqual([expect.objectContaining({ decisions: "acted", domain: "market_observatory", measured: 1, worsened: 1 })])
  })
})
