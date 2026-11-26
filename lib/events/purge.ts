/**
 * Executor of the 90-day raw-event purge (founder decision D3, 2026-11-23). NOT scheduled, NOT wired to a database:
 * the storage of daily aggregates needs a migration (D5, not applied), and without stored aggregates every
 * past-retention day is BLOCKED — this executor then deletes nothing, by construction.
 *
 * `EVENTS_PURGE_MODE` = off (DEFAULT: does nothing) | observe (counts what would be deleted, deletes nothing) |
 * enforce (founder decision). In enforce each day is: counted → deleted → counted again → proof written (counts only,
 * no identifier). A day whose after-count is not 0 is reported unverified and stops the run.
 */
import { planEventPurge, verifyPurgeDay, type PurgeDayProof } from "@/lib/events/aggregate"

export type EventsPurgeMode = "off" | "observe" | "enforce"

export function readEventsPurgeMode(env: Record<string, string | undefined> = process.env): EventsPurgeMode {
  const v = (env.EVENTS_PURGE_MODE ?? "").trim()
  return v === "observe" || v === "enforce" ? v : "off"
}

export type PurgeDeps = {
  /** UTC days (YYYY-MM-DD) that still hold raw behavioural rows. */
  listRawDays(): Promise<string[]>
  /** Days whose aggregates are durably stored. */
  loadAggregatedDays(): Promise<Set<string>>
  countDay(day: string): Promise<number>
  deleteDay(day: string): Promise<number>
  recordProof(proof: PurgeDayProof & { mode: "enforce" }): Promise<void>
}

export type PurgeRunResult = {
  mode: EventsPurgeMode
  blocked: string[]
  wouldDelete: { day: string; rows: number }[]
  proofs: PurgeDayProof[]
  stoppedOnUnverified: string | null
}

export async function runEventPurge(deps: PurgeDeps, opts: { mode: EventsPurgeMode; now: Date; maxDays?: number }): Promise<PurgeRunResult> {
  const result: PurgeRunResult = { mode: opts.mode, blocked: [], wouldDelete: [], proofs: [], stoppedOnUnverified: null }
  if (opts.mode === "off") return result
  const plan = planEventPurge({ now: opts.now, rawDays: await deps.listRawDays(), aggregatedDays: await deps.loadAggregatedDays() })
  result.blocked = plan.blocked
  for (const day of plan.purgeable.slice(0, opts.maxDays ?? 31)) {
    const before = await deps.countDay(day)
    if (opts.mode === "observe") {
      result.wouldDelete.push({ day, rows: before })
      continue
    }
    const deleted = await deps.deleteDay(day)
    const after = await deps.countDay(day)
    const proof = verifyPurgeDay(day, before, deleted, after)
    result.proofs.push(proof)
    await deps.recordProof({ ...proof, mode: "enforce" })
    if (!proof.verified) {
      result.stoppedOnUnverified = day
      break
    }
  }
  return result
}
