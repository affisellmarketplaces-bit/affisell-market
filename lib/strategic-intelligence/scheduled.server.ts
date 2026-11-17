import "server-only"

import { Prisma } from "@prisma/client"

import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { loadIntelligenceCockpit } from "@/lib/strategic-intelligence/collect.server"
import { signalSnapshot } from "@/lib/strategic-intelligence/journal"
import { measureDecision } from "@/lib/strategic-intelligence/journal.server"
import { buildFounderDigest, neutraliseMentions, NOTIFIED_PRIORITIES, type MeasuredOutcome } from "@/lib/strategic-intelligence/scheduled"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const MAX_MEASURES_PER_RUN = 50

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  const msg = error instanceof Error ? error.message : String(error)
  return code === "P2021" || /does not exist/i.test(msg)
}

/** Logs the signals of a scheduled run (insert or refresh). Returns false when the table is missing. */
export async function recordSignalRun(signals: StrategicSignal[], now: Date): Promise<boolean> {
  try {
    for (const s of signals) {
      const snapshot = JSON.stringify(signalSnapshot(s))
      await prisma.$executeRaw`
        INSERT INTO "IntelligenceSignalLog" ("signalId","domain","priority","kind","title","firstSeenAt","lastSeenAt","timesSeen","lastSnapshot")
        VALUES (${s.id}, ${s.domain}, ${s.priority}, ${s.kind}, ${s.title.slice(0, 500)}, ${now}, ${now}, 1, ${snapshot}::jsonb)
        ON CONFLICT ("signalId") DO UPDATE SET
          "lastSeenAt" = GREATEST("IntelligenceSignalLog"."lastSeenAt", EXCLUDED."lastSeenAt"),
          "timesSeen" = "IntelligenceSignalLog"."timesSeen" + 1,
          "priority" = EXCLUDED."priority",
          "kind" = EXCLUDED."kind",
          "title" = EXCLUDED."title",
          "lastSnapshot" = EXCLUDED."lastSnapshot"`
    }
    return true
  } catch (error) {
    if (isMissingTable(error)) return false
    throw error
  }
}

/**
 * Claims the not-yet-announced signals of this run (critical / important) — UPDATE … WHERE "notifiedAt" IS NULL is the
 * claim, so two concurrent runs never announce the same signal. A signal that was announced once is not announced
 * again, even if its priority changes (the page shows it).
 */
export async function claimSignalsToAnnounce(signals: StrategicSignal[], now: Date): Promise<StrategicSignal[]> {
  const ids = signals.filter((s) => NOTIFIED_PRIORITIES.includes(s.priority)).map((s) => s.id)
  if (ids.length === 0) return []
  try {
    const rows = await prisma.$queryRaw<Array<{ signalId: string }>>`
      UPDATE "IntelligenceSignalLog" SET "notifiedAt" = ${now}
      WHERE "signalId" IN (${Prisma.join(ids)}) AND "notifiedAt" IS NULL
      RETURNING "signalId"`
    const claimed = new Set(rows.map((r) => r.signalId))
    return signals.filter((s) => claimed.has(s.id))
  } catch (error) {
    if (isMissingTable(error)) return []
    throw error
  }
}

async function recordNotifyResult(ids: string[], result: "sent" | "no_channel" | "failed"): Promise<void> {
  if (ids.length === 0) return
  await prisma.$executeRaw`UPDATE "IntelligenceSignalLog" SET "notifyResult" = ${result} WHERE "signalId" IN (${Prisma.join(ids)})`
}

/** Measures the open decisions that came due (oldest first, bounded). Each is measured once by its own unique key. */
export async function measureDueDecisions(now: Date): Promise<{ outcomes: MeasuredOutcome[]; failed: number; available: boolean }> {
  let due: Array<{ id: string; title: string; decision: string }>
  try {
    due = await prisma.intelligenceDecision.findMany({
      where: { status: "open", dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: MAX_MEASURES_PER_RUN,
      select: { id: true, title: true, decision: true },
    })
  } catch (error) {
    if (isMissingTable(error)) return { outcomes: [], failed: 0, available: false }
    throw error
  }
  const outcomes: MeasuredOutcome[] = []
  let failed = 0
  for (const d of due) {
    try {
      const r = await measureDecision(d.id, { measuredById: null, now })
      if (r.ok && !r.alreadyMeasured) outcomes.push({ decisionId: d.id, title: d.title, decision: d.decision, verdict: r.verdict })
    } catch (error) {
      failed++
      console.error("[intelligence-daily] measure_failed", { decisionId: d.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { outcomes, failed, available: true }
}

export type IntelligenceDailyResult = {
  signals: number
  logAvailable: boolean
  announced: number
  measured: number
  measureFailed: number
  journalAvailable: boolean
  notify: "sent" | "no_channel" | "failed" | "nothing_new"
  failedCollectors: string[]
}

/** The daily scheduled run. Writes only the signal log, outcomes and the decision status — never a price or money. */
export async function runIntelligenceDaily(now = new Date()): Promise<IntelligenceDailyResult> {
  const cockpit = await loadIntelligenceCockpit(now)
  const logAvailable = await recordSignalRun(cockpit.signals, now)
  const announce = logAvailable ? await claimSignalsToAnnounce(cockpit.signals, now) : []
  const measured = await measureDueDecisions(now)
  const failedCollectors = cockpit.collectors.filter((c) => !c.ok)
  const digest = buildFounderDigest({
    newSignals: announce,
    outcomes: measured.outcomes,
    failedCollectors,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
  })
  let notify: IntelligenceDailyResult["notify"] = "nothing_new"
  if (digest) {
    let delivered: "sent" | "no_channel" | "failed"
    try {
      const sent = await opsWebhookAlert(neutraliseMentions(digest))
      const configured = Boolean(process.env.SLACK_WEBHOOK_URL?.trim() || process.env.DISCORD_WEBHOOK_URL?.trim())
      delivered = sent.slack || sent.discord ? "sent" : configured ? "failed" : "no_channel"
    } catch {
      delivered = "failed"
    }
    notify = delivered
    await recordNotifyResult(announce.map((s) => s.id), delivered)
  }
  return {
    signals: cockpit.signals.length,
    logAvailable,
    announced: announce.length,
    measured: measured.outcomes.length,
    measureFailed: measured.failed,
    journalAvailable: measured.available,
    notify,
    failedCollectors: failedCollectors.map((c) => c.id),
  }
}

export type SignalHistory = { firstSeenAt: string; lastSeenAt: string; timesSeen: number }

/** Read-only, for the page: when each signal was first raised by a scheduled run. Missing table = no history. */
export async function loadSignalHistory(ids: string[]): Promise<Record<string, SignalHistory>> {
  if (ids.length === 0) return {}
  try {
    const rows = await prisma.intelligenceSignalLog.findMany({
      where: { signalId: { in: ids } },
      select: { signalId: true, firstSeenAt: true, lastSeenAt: true, timesSeen: true },
    })
    return Object.fromEntries(
      rows.map((r) => [r.signalId, { firstSeenAt: r.firstSeenAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(), timesSeen: r.timesSeen }])
    )
  } catch (error) {
    if (isMissingTable(error)) return {}
    throw error
  }
}
