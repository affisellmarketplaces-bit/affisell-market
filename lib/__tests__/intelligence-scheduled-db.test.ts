/**
 * Scheduled intelligence run on a REAL PostgreSQL (migrations 20261117150000_intelligence_decision_journal +
 * 20261117180000_intelligence_signal_log): the signal log keeps the FIRST sighting, a signal is announced ONCE even with
 * concurrent runs, "study" signals are never announced, and a due decision is measured by the run. The cockpit and the
 * ops webhook are replaced (they are network); everything written is real.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"
import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

const h = vi.hoisted(() => ({ signals: [] as unknown[], alerts: [] as string[] }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/strategic-intelligence/collect.server", () => ({
  loadIntelligenceCockpit: async (now: Date) => ({ generatedAt: now.toISOString(), signals: h.signals, sources: [], coverage: {}, collectors: [] }),
}))
vi.mock("@/lib/ops-webhook", () => ({
  opsWebhookAlert: async (text: string) => {
    h.alerts.push(text)
    return { slack: true, discord: false }
  },
}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

function statements(sql: string): string[] {
  return sql.replace(/^--.*$/gm, "").split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)
}
const MIG = (name: string) => path.join(process.cwd(), "prisma/migrations", name, "migration.sql")
const stamp = Date.now()
const t0 = new Date("2026-11-17T09:00:00.000Z")

const sig = (id: string, priority: StrategicSignal["priority"]): StrategicSignal => ({
  id, domain: "market_observatory", priority, kind: "fact", title: `Signal ${id}`, evidence: [], source: { id: "x", query: "q" },
  observedAt: t0.toISOString(), window: null, confidence: "high", confidenceReason: "r", recommendedAction: "a", link: null,
})

describe.skipIf(!RUN_DB)("scheduled intelligence run — real DB", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let sched: typeof import("@/lib/strategic-intelligence/scheduled.server")
  let journal: typeof import("@/lib/strategic-intelligence/journal.server")
  const crit = `risk:test-critical:${stamp}`
  const study = `risk:test-study:${stamp}`

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    sched = await import("@/lib/strategic-intelligence/scheduled.server")
    journal = await import("@/lib/strategic-intelligence/journal.server")
    for (const t of ["IntelligenceDecision", "IntelligenceOutcome", "IntelligenceSignalLog"]) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`)
    }
    for (const name of ["20261117150000_intelligence_decision_journal", "20261117180000_intelligence_signal_log"]) {
      const parts = statements(readFileSync(MIG(name), "utf8"))
      for (let round = 0; round < 2; round++) for (const s of parts) await prisma.$executeRawUnsafe(s)
    }
  }, 60_000)

  afterAll(async () => {
    if (prisma) await prisma.$disconnect()
  })

  it("first run: logs both signals, announces only the critical one, once — even with concurrent runs", async () => {
    h.signals = [sig(crit, "critical"), sig(study, "study")]
    const runs = await Promise.all(Array.from({ length: 3 }, () => sched.runIntelligenceDaily(t0)))
    expect(runs.reduce((n, r) => n + r.announced, 0)).toBe(1)
    expect(h.alerts.filter((a) => a.includes(`Signal ${crit}`))).toHaveLength(1)
    expect(h.alerts.some((a) => a.includes(`Signal ${study}`))).toBe(false)
    const row = await prisma.intelligenceSignalLog.findUniqueOrThrow({ where: { signalId: crit } })
    expect(row).toMatchObject({ notifyResult: "sent", timesSeen: 3 })
    expect(row.firstSeenAt.toISOString()).toBe(t0.toISOString())
  })

  it("a later run keeps the first sighting and announces nothing again", async () => {
    const before = h.alerts.length
    const later = new Date(t0.getTime() + DAY_MS)
    const r = await sched.runIntelligenceDaily(later)
    expect(r).toMatchObject({ announced: 0, notify: "nothing_new" })
    expect(h.alerts.length).toBe(before)
    const hist = await sched.loadSignalHistory([crit, study, "unknown"])
    expect(hist[crit]).toMatchObject({ firstSeenAt: t0.toISOString(), lastSeenAt: later.toISOString(), timesSeen: 4 })
    expect(hist.unknown).toBeUndefined()
  })

  it("measures a due decision during the run and reports its verdict in the digest", async () => {
    const decisionSignal = sig(`market:category:fall:cat-${stamp}`, "important")
    const rec = await journal.recordDecision({
      signal: decisionSignal, decision: "watch", rationale: "On observe", measureAfterDays: 7, decidedById: "admin", now: t0,
      measure: async () => ({ value: 30, count: 30, base: null }),
    })
    expect(rec).toMatchObject({ ok: true })
    h.signals = []
    const due = new Date(t0.getTime() + 8 * DAY_MS)
    const r = await sched.runIntelligenceDaily(due)
    // The real measurement reads "Order": the throwaway database has none in that window → 0 orders, 30 → 0 = worsened.
    expect(r).toMatchObject({ measured: 1, measureFailed: 0, notify: "sent" })
    expect(h.alerts.at(-1)).toContain("Surveiller — Signal market:category:fall")
    expect((await prisma.intelligenceDecision.findUniqueOrThrow({ where: { id: (rec as { id: string }).id } })).status).toBe("measured")
    expect((await sched.runIntelligenceDaily(due)).measured).toBe(0) // measured once
  })

  it("the log refuses an unknown priority", async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO "IntelligenceSignalLog" ("signalId","domain","priority","kind","title","firstSeenAt","lastSeenAt","lastSnapshot") VALUES (${`x${stamp}`}, 'd', 'urgent', 'fact', 't', now(), now(), '{}'::jsonb)`
    ).rejects.toThrow()
  })
})
