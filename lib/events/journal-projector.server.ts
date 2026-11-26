import "server-only"

import {
  deliveryEvent,
  isJournalEnabled,
  listingAddedEvent,
  purchaseEvent,
  refundEvent,
  returnEvents,
  reviewEvent,
} from "@/lib/events/journal-mapping"
import { recordEvents, type RecordResult } from "@/lib/events/record.server"
import type { ServerEventInput } from "@/lib/events/row"
import { prisma } from "@/lib/prisma"

/**
 * Step S2 — projects the business journal from the source tables for a time window (see journal-mapping.ts).
 *
 * Off unless `EVENTS_JOURNAL=on` — the `event_spine` migration must be applied and verified in production first
 * (`npm run schema:verify`, docs/DEPLOY-SCHEMA-CHANGES.md). Idempotent (deterministic eventIds), read-only on the
 * sources, NEVER throws: a source that fails is reported and the others still run.
 */
export { isJournalEnabled }

export const JOURNAL_SOURCES = ["purchase", "refund", "return", "delivery", "review", "listing"] as const
export type JournalSource = (typeof JOURNAL_SOURCES)[number]

export type JournalProjectionResult = {
  enabled: boolean
  window: { since: string; until: string }
  bySource: Partial<
    Record<
      JournalSource,
      { rows: number; events: number; written: number; duplicates: number; truncated: boolean; error: string | null }
    >
  >
}

/** Rows per page; a source is read page after page until its window is exhausted. */
export const JOURNAL_PAGE_SIZE = 1_000
/**
 * Safety bound per source and run (500 000 rows). Reached = `truncated: true` in the result and a log line: run the
 * backfill again with a narrower `--since/--until` window. Never a silent cut.
 */
export const JOURNAL_MAX_PAGES = 500

async function loadSource(
  source: JournalSource,
  since: Date,
  until: Date,
  page: { skip: number; take: number }
): Promise<{ rows: number; events: ServerEventInput[] }> {
  const window = { gte: since, lt: until }
  const MAX_ROWS_PER_SOURCE = page.take
  const skip = page.skip
  switch (source) {
    case "purchase": {
      const rows = await prisma.order.findMany({
        where: { paidAt: window },
        select: {
          id: true,
          productId: true,
          affiliateProductId: true,
          supplierId: true,
          affiliateId: true,
          quantity: true,
          totalCents: true,
          currency: true,
          stripeSessionId: true,
          paidAt: true,
        },
        orderBy: [{ paidAt: "asc" }, { id: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap((r) => purchaseEvent(r) ?? []) }
    }
    case "refund": {
      const rows = await prisma.orderStripeRefund.findMany({
        where: { createdAt: window },
        select: {
          stripeRefundId: true,
          orderId: true,
          amountCents: true,
          reason: true,
          createdAt: true,
          order: { select: { productId: true, affiliateProductId: true, supplierId: true, affiliateId: true, currency: true } },
        },
        orderBy: [{ createdAt: "asc" }, { stripeRefundId: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.map(refundEvent) }
    }
    case "return": {
      // Created OR updated in the window: a return opened earlier and resolved now must emit its resolution.
      const rows = await prisma.orderReturn.findMany({
        where: { OR: [{ createdAt: window }, { updatedAt: window }] },
        select: {
          id: true,
          orderId: true,
          status: true,
          reasonCode: true,
          createdAt: true,
          updatedAt: true,
          refundedAt: true,
          order: { select: { productId: true, supplierId: true, affiliateId: true } },
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap(returnEvents) }
    }
    case "delivery": {
      const rows = await prisma.order.findMany({
        where: { deliveredAt: window },
        select: { id: true, productId: true, supplierId: true, affiliateId: true, deliveredAt: true },
        orderBy: [{ deliveredAt: "asc" }, { id: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap((r) => deliveryEvent(r) ?? []) }
    }
    case "review": {
      // Written OR published OR moderated in the window: a review approved days later is still journaled.
      const rows = await prisma.review.findMany({
        where: { OR: [{ createdAt: window }, { publishedAt: window }, { updatedAt: window }] },
        select: { id: true, productId: true, orderId: true, rating: true, status: true, createdAt: true, publishedAt: true },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap((r) => reviewEvent({ ...r, status: String(r.status) }) ?? []) }
    }
    case "listing": {
      const rows = await prisma.affiliateProduct.findMany({
        where: { createdAt: window },
        select: { id: true, productId: true, affiliateId: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.map(listingAddedEvent) }
    }
  }
}

/**
 * Pages of one source over a window, in the projection's deterministic order — shared by the projection and the
 * read-only reconciliation (`journal-reconcile.server.ts`), so both see exactly the same events. Stops at the end of
 * the window or at {@link JOURNAL_MAX_PAGES} (then `truncated` is reported by the caller).
 */
export async function* iterateJournalSource(
  source: JournalSource,
  since: Date,
  until: Date
): AsyncGenerator<{ page: number; rows: number; events: ServerEventInput[] }> {
  for (let page = 0; page < JOURNAL_MAX_PAGES; page++) {
    const { rows, events } = await loadSource(source, since, until, {
      skip: page * JOURNAL_PAGE_SIZE,
      take: JOURNAL_PAGE_SIZE,
    })
    yield { page, rows, events }
    if (rows < JOURNAL_PAGE_SIZE) return
  }
}

export async function projectBusinessJournal(args: {
  since: Date
  until?: Date
  sources?: readonly JournalSource[]
  /** Read and map only: count what WOULD be written (backfill dry run). */
  dryRun?: boolean
  env?: Record<string, string | undefined>
}): Promise<JournalProjectionResult> {
  const until = args.until ?? new Date()
  const result: JournalProjectionResult = {
    enabled: isJournalEnabled(args.env),
    window: { since: args.since.toISOString(), until: until.toISOString() },
    bySource: {},
  }
  if (!result.enabled && !args.dryRun) return result

  for (const source of args.sources ?? JOURNAL_SOURCES) {
    const totals = { rows: 0, events: 0, written: 0, duplicates: 0, truncated: false, error: null as string | null }
    try {
      let lastPage = -1
      let lastRows = 0
      for await (const { page, rows, events } of iterateJournalSource(source, args.since, until)) {
        lastPage = page
        lastRows = rows
        totals.rows += rows
        totals.events += events.length
        if (!args.dryRun && events.length > 0) {
          // Transactional events: consent does not apply (and behavioral ones are never produced here).
          const rec: RecordResult = await recordEvents(events, { analyticsConsent: false })
          totals.written += rec.written
          totals.duplicates += rec.duplicates
          if (rec.error) {
            totals.error = rec.error
            break
          }
        }
      }
      if (!totals.error && lastPage === JOURNAL_MAX_PAGES - 1 && lastRows === JOURNAL_PAGE_SIZE) {
        totals.truncated = true
        console.warn("[events-journal]", { source, result: "truncated", rows: totals.rows, hint: "narrow the window" })
      }
    } catch (e) {
      totals.error = e instanceof Error ? e.message : String(e)
      console.error("[events-journal]", { source, error: totals.error })
    }
    result.bySource[source] = totals
  }
  console.log("[events-journal]", result)
  return result
}
