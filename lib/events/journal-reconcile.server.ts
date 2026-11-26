import "server-only"

import { smoothedRefundRate } from "@/lib/events/journal-mapping"
import {
  JOURNAL_MAX_PAGES,
  JOURNAL_PAGE_SIZE,
  JOURNAL_SOURCES,
  iterateJournalSource,
  type JournalSource,
} from "@/lib/events/journal-projector.server"
import { prisma } from "@/lib/prisma"
import { DEFAULT_EXPECTED_REFUND_RATE } from "@/lib/reseller-margin-guard"

/**
 * READ-ONLY proof that the business journal matches its sources (S2 activation checklist, docs/EVENTS-JOURNAL-S2.md).
 *
 * For a window, the EXPECTED events are rebuilt from the source tables with the projection's own code
 * (`iterateJournalSource` → same mapping, same deterministic eventIds), then compared with what the journal holds:
 *
 * - missing:  expected eventIds absent from the journal (a gap: re-run the backfill on the window — idempotent);
 * - orphans:  journal events of that source, dated in the window, that the sources do not produce (should be 0;
 *             events at the window's edges are dated by a field the selection may not cover → inspect before acting);
 * - refund-rate coherence: per product, the guard's smoothed refund rate from the journal vs from the sources.
 *
 * Writes nothing, never throws (a failing source is reported with its error).
 */
export const RECONCILE_SAMPLE = 20
const ID_CHUNK = 1_000

/** Event names each source produces (see journal-mapping.ts). */
export const SOURCE_EVENT_TYPES: Record<JournalSource, readonly string[]> = {
  purchase: ["purchase"],
  refund: ["refund"],
  return: ["return_requested", "return_resolved"],
  delivery: ["delivery"],
  review: ["review_created"],
  listing: ["creator_product_added"],
}

export type SourceReconciliation = {
  expected: number
  present: number
  missing: number
  missingSample: string[]
  orphans: number
  orphanSample: string[]
  truncated: boolean
  error: string | null
}

export type RefundRateDrift = { productId: string; journalRate: number; sourceRate: number }

export type JournalReconciliation = {
  window: { since: string; until: string }
  bySource: Partial<Record<JournalSource, SourceReconciliation>>
  refundRates: { productsCompared: number; maxAbsDiff: number; drifts: RefundRateDrift[] }
  /** True when every source is complete (no missing, no orphan, no error, not truncated). */
  consistent: boolean
}

type Counts = Map<string, { purchases: number; refunds: number }>

function bump(map: Counts, productId: string | null | undefined, kind: "purchases" | "refunds") {
  if (!productId) return
  const c = map.get(productId) ?? { purchases: 0, refunds: 0 }
  c[kind] += 1
  map.set(productId, c)
}

export async function reconcileBusinessJournal(args: {
  since: Date
  until: Date
  sources?: readonly JournalSource[]
  /** Report a product's refund rate as drifting above this absolute difference. */
  refundRateTolerance?: number
}): Promise<JournalReconciliation> {
  const out: JournalReconciliation = {
    window: { since: args.since.toISOString(), until: args.until.toISOString() },
    bySource: {},
    refundRates: { productsCompared: 0, maxAbsDiff: 0, drifts: [] },
    consistent: true,
  }
  const sourceCounts: Counts = new Map()
  const journalCounts: Counts = new Map()

  for (const source of args.sources ?? JOURNAL_SOURCES) {
    const r: SourceReconciliation = {
      expected: 0,
      present: 0,
      missing: 0,
      missingSample: [],
      orphans: 0,
      orphanSample: [],
      truncated: false,
      error: null,
    }
    try {
      const expected = new Set<string>()
      let pages = 0
      let lastRows = 0
      for await (const { rows, events } of iterateJournalSource(source, args.since, args.until)) {
        pages += 1
        lastRows = rows
        for (const e of events) {
          if (!e.eventId) continue
          expected.add(e.eventId)
          if (e.name === "purchase") bump(sourceCounts, e.productId, "purchases")
          if (e.name === "refund") bump(sourceCounts, e.productId, "refunds")
        }
      }
      r.truncated = pages >= JOURNAL_MAX_PAGES && lastRows === JOURNAL_PAGE_SIZE
      r.expected = expected.size

      const ids = [...expected]
      const present = new Set<string>()
      for (let i = 0; i < ids.length; i += ID_CHUNK) {
        const found = await prisma.affisellTrackEvent.findMany({
          where: { eventId: { in: ids.slice(i, i + ID_CHUNK) } },
          select: { eventId: true },
        })
        for (const f of found) if (f.eventId) present.add(f.eventId)
      }
      r.present = present.size
      const missing = ids.filter((id) => !present.has(id))
      r.missing = missing.length
      r.missingSample = missing.slice(0, RECONCILE_SAMPLE)

      // Journal side, same window and event types: orphans + per-product counts for the refund-rate check.
      let cursor: string | undefined
      for (;;) {
        const batch = await prisma.affisellTrackEvent.findMany({
          where: {
            eventClass: "transactional",
            eventType: { in: [...SOURCE_EVENT_TYPES[source]] },
            occurredAt: { gte: args.since, lt: args.until },
          },
          select: { id: true, eventId: true, eventType: true, productId: true },
          orderBy: { id: "asc" },
          take: ID_CHUNK,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        })
        for (const ev of batch) {
          if (ev.eventId && !expected.has(ev.eventId)) {
            r.orphans += 1
            if (r.orphanSample.length < RECONCILE_SAMPLE) r.orphanSample.push(ev.eventId)
          }
          if (ev.eventType === "purchase") bump(journalCounts, ev.productId, "purchases")
          if (ev.eventType === "refund") bump(journalCounts, ev.productId, "refunds")
        }
        if (batch.length < ID_CHUNK) break
        cursor = batch[batch.length - 1]!.id
      }
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e)
    }
    if (r.missing > 0 || r.orphans > 0 || r.error || r.truncated) out.consistent = false
    out.bySource[source] = r
  }

  // The guard's input, computed both ways: a drift means the journal would mislead the recommendations.
  const tolerance = args.refundRateTolerance ?? 0.005
  const products = new Set([...sourceCounts.keys(), ...journalCounts.keys()])
  for (const productId of products) {
    const rate = (c: { purchases: number; refunds: number } | undefined) =>
      smoothedRefundRate({
        purchases: c?.purchases ?? 0,
        refunds: c?.refunds ?? 0,
        prior: DEFAULT_EXPECTED_REFUND_RATE,
      })
    const journalRate = rate(journalCounts.get(productId))
    const sourceRate = rate(sourceCounts.get(productId))
    const diff = Math.abs(journalRate - sourceRate)
    out.refundRates.productsCompared += 1
    out.refundRates.maxAbsDiff = Math.max(out.refundRates.maxAbsDiff, diff)
    if (diff > tolerance && out.refundRates.drifts.length < RECONCILE_SAMPLE) {
      out.refundRates.drifts.push({ productId, journalRate, sourceRate })
    }
  }
  if (out.refundRates.maxAbsDiff > tolerance) out.consistent = false
  return out
}
