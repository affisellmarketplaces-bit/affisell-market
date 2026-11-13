import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

/**
 * Dispute hold ledger (finalisation master doc, D7) — one `ProcessedWebhook` row per (dispute, order), WITHOUT a schema
 * migration. `ProcessedWebhook` is already the generic idempotency ledger of this code base (CSV import, Resend, onboarding
 * mails…); our ids start with `dispute:` so they can never collide with a Stripe event id (`evt_…`), and the statuses are
 * `dispute_*`, never "success": `stripe-health` counts only `status = "success"` rows as proof of a handled payment, and
 * the failed-webhook replay job only reads `evt_…` ids with status "failed".
 *
 * Why a ledger and not just `Order.status = "disputed"`: other writers of `Order.status` (tracking webhook, supplier
 * routes) write "shipped" without reading it. The payout release asks THIS ledger, so a dispute that is still open keeps
 * the money held whatever the status says. The row also keeps the exact status the order had before the dispute (in the
 * `error` column, as JSON) so that winning the dispute restores it exactly.
 */

type HoldDb = Pick<Prisma.TransactionClient, "processedWebhook">

export const DISPUTE_HOLD_ID_PREFIX = "dispute:"

export const DISPUTE_HOLD_STATUS = {
  open: "dispute_open",
  won: "dispute_won",
  lost: "dispute_lost",
  closed: "dispute_closed",
} as const

export type DisputeHoldTerminalOutcome = "won" | "lost" | "closed"

export type DisputeHold = {
  status: string
  previousStatus: string | null
}

export function disputeHoldId(disputeId: string, orderId: string): string {
  return `${DISPUTE_HOLD_ID_PREFIX}${disputeId}:${orderId}`
}

function encodeNote(previousStatus: string | null): string | null {
  return previousStatus ? JSON.stringify({ previousStatus }) : null
}

function decodeNote(note: string | null | undefined): string | null {
  if (!note) return null
  try {
    const parsed = JSON.parse(note) as { previousStatus?: unknown }
    return typeof parsed.previousStatus === "string" && parsed.previousStatus.trim() !== ""
      ? parsed.previousStatus
      : null
  } catch {
    return null
  }
}

/**
 * True when at least one dispute is still open on the order: no payout may be released. A database error PROPAGATES
 * (the caller must not release money on "I could not read the ledger").
 */
export async function hasOpenDisputeHold(
  orderId: string,
  db: HoldDb = prisma,
  options?: { exceptDisputeId?: string }
): Promise<boolean> {
  const open = await db.processedWebhook.count({
    where: {
      orderId,
      id: { startsWith: DISPUTE_HOLD_ID_PREFIX },
      status: DISPUTE_HOLD_STATUS.open,
      // "Is ANOTHER dispute still open on this order?": used when one dispute closes, before its own row is rewritten.
      ...(options?.exceptDisputeId ? { NOT: { id: disputeHoldId(options.exceptDisputeId, orderId) } } : {}),
    },
  })
  return open > 0
}

export async function readDisputeHold(
  db: HoldDb,
  disputeId: string,
  orderId: string
): Promise<DisputeHold | null> {
  const row = await db.processedWebhook.findUnique({ where: { id: disputeHoldId(disputeId, orderId) } })
  if (!row) return null
  return { status: row.status, previousStatus: decodeNote(row.error) }
}

/**
 * Register (or confirm) the hold. Never reopens a closed hold: a late `charge.dispute.created` replayed after the
 * `closed` event must not hold money again.
 */
export async function openDisputeHold(
  db: HoldDb,
  args: { disputeId: string; orderId: string; previousStatus: string | null }
): Promise<"created" | "already_open" | "already_closed"> {
  const existing = await readDisputeHold(db, args.disputeId, args.orderId)
  if (existing) {
    return existing.status === DISPUTE_HOLD_STATUS.open ? "already_open" : "already_closed"
  }
  const id = disputeHoldId(args.disputeId, args.orderId)
  await db.processedWebhook.upsert({
    where: { id },
    create: {
      id,
      orderId: args.orderId,
      status: DISPUTE_HOLD_STATUS.open,
      error: encodeNote(args.previousStatus),
    },
    update: {},
  })
  return "created"
}

/**
 * Replace the status remembered for an OPEN hold. Used when an open-type event finds the order moved on since the hold was
 * created (an automated tracking writer set "shipped" while the dispute was open): the status written back as "disputed"
 * is what a win must restore, not the older one captured at creation. A terminal row is never touched.
 */
export async function refreshDisputeHoldPreviousStatus(
  db: HoldDb,
  args: { disputeId: string; orderId: string; previousStatus: string | null }
): Promise<void> {
  if (!args.previousStatus) return
  await db.processedWebhook.updateMany({
    where: { id: disputeHoldId(args.disputeId, args.orderId), status: DISPUTE_HOLD_STATUS.open },
    data: { error: encodeNote(args.previousStatus) },
  })
}

/**
 * Close the hold with a terminal outcome. Creates the row when the closing event arrived before any opening one (Stripe
 * does not guarantee the order of events). A terminal hold is never rewritten.
 */
export async function closeDisputeHold(
  db: HoldDb,
  args: { disputeId: string; orderId: string; outcome: DisputeHoldTerminalOutcome }
): Promise<void> {
  const id = disputeHoldId(args.disputeId, args.orderId)
  const status = DISPUTE_HOLD_STATUS[args.outcome]
  const updated = await db.processedWebhook.updateMany({
    where: { id, status: DISPUTE_HOLD_STATUS.open },
    data: { status },
  })
  if (updated.count > 0) return
  await db.processedWebhook.upsert({
    where: { id },
    create: { id, orderId: args.orderId, status, error: null },
    update: {},
  })
}
