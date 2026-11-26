import "server-only"

import {
  deliveryEvent,
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
export function isJournalEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EVENTS_JOURNAL?.trim().toLowerCase() === "on"
}

export const JOURNAL_SOURCES = ["purchase", "refund", "return", "delivery", "review", "listing"] as const
export type JournalSource = (typeof JOURNAL_SOURCES)[number]

export type JournalProjectionResult = {
  enabled: boolean
  window: { since: string; until: string }
  bySource: Partial<Record<JournalSource, { rows: number; events: number; written: number; duplicates: number; error: string | null }>>
}

/** Rows read per source per run — a window larger than this is resumed by the next run (overlapping windows are free). */
const MAX_ROWS_PER_SOURCE = 5_000

async function loadSource(source: JournalSource, since: Date, until: Date): Promise<{ rows: number; events: ServerEventInput[] }> {
  const window = { gte: since, lt: until }
  switch (source) {
    case "purchase": {
      const rows = await prisma.order.findMany({
        where: { createdAt: window },
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
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
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
        orderBy: { createdAt: "asc" },
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
        orderBy: { updatedAt: "asc" },
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap(returnEvents) }
    }
    case "delivery": {
      const rows = await prisma.order.findMany({
        where: { deliveredAt: window },
        select: { id: true, productId: true, supplierId: true, affiliateId: true, deliveredAt: true },
        orderBy: { deliveredAt: "asc" },
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap((r) => deliveryEvent(r) ?? []) }
    }
    case "review": {
      const rows = await prisma.review.findMany({
        where: { createdAt: window },
        select: { id: true, productId: true, orderId: true, rating: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.flatMap((r) => reviewEvent({ ...r, status: String(r.status) }) ?? []) }
    }
    case "listing": {
      const rows = await prisma.affiliateProduct.findMany({
        where: { createdAt: window },
        select: { id: true, productId: true, affiliateId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS_PER_SOURCE,
      })
      return { rows: rows.length, events: rows.map(listingAddedEvent) }
    }
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
    try {
      const { rows, events } = await loadSource(source, args.since, until)
      let rec: RecordResult | null = null
      if (!args.dryRun && events.length > 0) {
        // Transactional events: consent does not apply (and behavioral ones are never produced here).
        rec = await recordEvents(events, { analyticsConsent: false })
      }
      result.bySource[source] = {
        rows,
        events: events.length,
        written: rec?.written ?? 0,
        duplicates: rec?.duplicates ?? 0,
        error: rec?.error ?? null,
      }
    } catch (e) {
      result.bySource[source] = { rows: 0, events: 0, written: 0, duplicates: 0, error: e instanceof Error ? e.message : String(e) }
      console.error("[events-journal]", { source, error: e instanceof Error ? e.message : String(e) })
    }
  }
  console.log("[events-journal]", result)
  return result
}
