import "server-only"

import { Prisma } from "@prisma/client"

import { buildEventRow, type DropReason, type EventRow, type RecordContext, type ServerEventInput } from "@/lib/events/row"
import { prisma } from "@/lib/prisma"

/** Rows per INSERT. A browser sends ≤ 20; a backfill may send thousands. */
const CHUNK_SIZE = 500

export type RecordResult = {
  received: number
  /** Rows actually inserted. */
  written: number
  /** Accepted events that were already stored (same eventId) or repeated inside the batch: harmless, counted. */
  duplicates: number
  dropped: Partial<Record<DropReason, number>>
  /** null = the database accepted everything it was given. */
  error: null | "schema_unavailable" | "write_failed"
}

function isSchemaDrift(e: unknown): boolean {
  // P2021 = table missing, P2022 = column missing: the migration lags behind this deploy.
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")
}

let warnedSchemaDrift = false

function toCreateInput(row: EventRow): Prisma.AffisellTrackEventCreateManyInput {
  const { properties, ...rest } = row
  return { ...rest, ...(properties ? { properties } : {}) }
}

/**
 * Stores events — idempotently. The unique `eventId` plus `skipDuplicates` (INSERT … ON CONFLICT DO NOTHING) means a
 * retried request, a replayed webhook, a double-fired effect or a re-run backfill can never create a second row.
 *
 * NEVER throws: an analytics or journal write must not be able to break the request that triggered it. A failure is
 * reported in the result (and logged); a database that has not been migrated yet is logged loudly ONCE per process —
 * it is a deployment problem to fix with `prisma migrate deploy`, not something to hide.
 */
export async function recordEvents(inputs: readonly ServerEventInput[], ctx: RecordContext): Promise<RecordResult> {
  const result: RecordResult = { received: inputs.length, written: 0, duplicates: 0, dropped: {}, error: null }
  if (inputs.length === 0) return result

  const seen = new Set<string>()
  const rows: EventRow[] = []
  for (const input of inputs) {
    let built: ReturnType<typeof buildEventRow>
    try {
      built = buildEventRow(input, ctx)
    } catch {
      // A hostile object (throwing getter…) must cost one event, never the request.
      built = { ok: false, reason: "malformed" }
    }
    if (!built.ok) {
      result.dropped[built.reason] = (result.dropped[built.reason] ?? 0) + 1
      continue
    }
    if (seen.has(built.row.eventId)) {
      result.duplicates += 1
      continue
    }
    seen.add(built.row.eventId)
    rows.push(built.row)
  }
  if (rows.length === 0) return result

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    try {
      const { count } = await prisma.affisellTrackEvent.createMany({
        data: chunk.map(toCreateInput),
        skipDuplicates: true,
      })
      result.written += count
      result.duplicates += chunk.length - count
    } catch (e) {
      if (isSchemaDrift(e)) {
        result.error = "schema_unavailable"
        if (!warnedSchemaDrift) {
          warnedSchemaDrift = true
          console.error("[events]", {
            result: "schema_drift",
            hint: "AffisellTrackEvent is missing spine columns: run `prisma migrate deploy` (migration event_spine). Events are dropped until then.",
          })
        }
        return result
      }
      result.error = "write_failed"
      console.error("[events]", { result: "write_failed", error: e instanceof Error ? e.message : String(e), chunk: chunk.length })
    }
  }
  return result
}
