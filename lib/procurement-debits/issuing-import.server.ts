import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { isPrismaSchemaMissingError } from "@/lib/prisma-schema-error"
import {
  nextImportStart,
  parseIssuingTransaction,
  planIssuingImport,
  type IssuingImportPlan,
  type IssuingTransaction,
} from "@/lib/procurement-debits/issuing-import"
import type { IssuingReader } from "@/lib/procurement-debits/issuing-reader"
import { REGISTER_AUDIT, allocateProcurementDebit } from "@/lib/procurement-debits/register.server"

/**
 * Applies an Issuing import plan (rules: issuing-import.ts). READ-ONLY towards Stripe: the only Stripe access is the
 * injected `IssuingReader` (one GET). Writes go to the register only — never a payment, refund or transfer, never an
 * order. NOT wired to any route, cron or webhook: running it is a founder decision (key, schedule, environment).
 *
 * Idempotent and resumable: the transaction id is the register's unique reference (a second run records nothing new),
 * the checkpoint (`AuditLog` `procurement-issuing-import-checkpoint`) only advances after every page of the window was
 * read and applied, and the next window starts two days before it. `apply: false` (the default) reads and plans only.
 */
export const ISSUING_IMPORT_ACTOR = "system:issuing-import"
export const ISSUING_CHECKPOINT_ID = "procurement-issuing-import-checkpoint"
const MAX_PAGES = 50

export type IssuingImportResult =
  | { ok: false; error: "register_unavailable" | "read_failed"; detail?: string }
  | {
      ok: true
      applied: boolean
      read: number
      unreadable: number
      plan: Omit<IssuingImportPlan, "record"> & { toRecord: number }
      recorded: number
      allocated: number
      allocationRefused: Array<{ reference: string; error: string }>
      truncated: boolean
      checkpoint: number | null
    }

async function readCheckpoint(): Promise<number | null> {
  const row = await prisma.auditLog.findUnique({ where: { id: ISSUING_CHECKPOINT_ID }, select: { payload: true } })
  const v = (row?.payload as { lastCreated?: unknown } | null)?.lastCreated
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null
}

export async function importIssuingTransactions(args: {
  reader: IssuingReader
  /** The mode the reader's key works in (`rk_live_` = true). */
  livemode: boolean
  /** Unix seconds; default = checkpoint − 2 days, else 30 days ago. */
  since?: number
  apply?: boolean
  now?: Date
}): Promise<IssuingImportResult> {
  const now = args.now ?? new Date()
  const apply = args.apply === true
  let start: number
  try {
    start = args.since ?? nextImportStart(await readCheckpoint(), Math.floor(now.getTime() / 1000) - 30 * 86_400)
  } catch (e) {
    if (isPrismaSchemaMissingError(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }

  const txs: IssuingTransaction[] = []
  let unreadable = 0
  const unreadableReasons: Array<{ reference: string | null; reason: string }> = []
  let cursor: string | undefined
  let pages = 0
  let truncated = false
  for (;;) {
    const page = await args.reader.listTransactions({ createdGte: start, startingAfter: cursor })
    if (!page.ok) return { ok: false, error: "read_failed", detail: page.reason }
    for (const raw of page.data) {
      const p = parseIssuingTransaction(raw)
      if (p.ok) txs.push(p.value)
      else {
        unreadable += 1
        unreadableReasons.push({ reference: null, reason: p.reason })
      }
    }
    pages += 1
    const last = page.data[page.data.length - 1] as { id?: unknown } | undefined
    if (!page.hasMore || typeof last?.id !== "string") break
    if (pages >= MAX_PAGES) {
      truncated = true
      break
    }
    cursor = last.id
  }

  try {
    const refs = txs.map((t) => t.id)
    const cards = [...new Set(txs.map((t) => t.card))]
    const existing = await prisma.procurementDebit.findMany({
      where: { source: "stripe_issuing", OR: [{ sourceReference: { in: refs } }, { issuingCardId: { in: cards } }] },
      select: { id: true, sourceReference: true, kind: true, amountCents: true, settledAmountCents: true, issuingCardId: true, issuingAuthorizationId: true },
    })
    const logs = cards.length
      ? await prisma.fulfillmentLog.findMany({ where: { virtualCardId: { in: cards } }, select: { orderId: true, virtualCardId: true } })
      : []
    const cardOrders = new Map<string, string[]>()
    for (const l of logs) if (l.virtualCardId) cardOrders.set(l.virtualCardId, [...new Set([...(cardOrders.get(l.virtualCardId) ?? []), l.orderId])])
    const plan = planIssuingImport({
      transactions: txs,
      existing: existing.map((e) => ({ ...e, kind: e.kind as "debit" | "refund" | "refund_reversal" | "fee" })),
      cardOrders,
      livemode: args.livemode,
    })
    const { record, ...rest } = plan
    const summary = { ...rest, skipped: [...rest.skipped, ...unreadableReasons], toRecord: record.length }
    const lastCreated = txs.length ? Math.max(...txs.map((t) => t.created)) : null
    if (!apply) {
      return { ok: true, applied: false, read: txs.length + unreadable, unreadable, plan: summary, recorded: 0, allocated: 0, allocationRefused: [], truncated, checkpoint: null }
    }

    const idByRef = new Map(existing.map((e) => [e.sourceReference, e.id]))
    let recorded = 0
    let allocated = 0
    const allocationRefused: Array<{ reference: string; error: string }> = []
    for (const m of record) {
      const parentId = m.parent == null ? null : "existingId" in m.parent ? m.parent.existingId : (idByRef.get(m.parent.reference) ?? null)
      // A parent that could not be recorded keeps the refund apart rather than guessing.
      const reviewReason = m.reviewReason ?? (m.kind !== "debit" && !parentId ? "achat d'origine non enregistré" : null)
      let id: string
      try {
        const row = await prisma.procurementDebit.create({
          data: {
            kind: m.kind,
            source: "stripe_issuing",
            amountOrigin: "read_from_source",
            sourceReference: m.reference,
            amountCents: m.amountCents,
            currency: m.currency,
            settledAmountCents: m.settledAmountCents,
            settledCurrency: m.settledAmountCents == null ? null : "EUR",
            occurredAt: new Date(m.occurredAt),
            parentDebitId: m.kind === "debit" ? null : parentId,
            issuingCardId: m.issuingCardId,
            issuingAuthorizationId: m.issuingAuthorizationId,
            balanceTransactionId: m.balanceTransactionId,
            vatTreatment: "unknown",
            evidence: [{ type: "source_order_record", reference: m.reference, description: "transaction Stripe Issuing lue par l'API" }] as unknown as Prisma.InputJsonValue,
            note: m.note,
            reviewState: reviewReason ? "needs_review" : "none",
            reviewReason,
            recordedById: ISSUING_IMPORT_ACTOR,
          },
          select: { id: true },
        })
        id = row.id
        recorded += 1
        await prisma.auditLog.create({
          data: {
            action: REGISTER_AUDIT.recorded,
            entityType: "ProcurementDebit",
            entityId: id,
            actorId: ISSUING_IMPORT_ACTOR,
            payload: { kind: m.kind, source: "stripe_issuing", amountCents: m.amountCents, currency: m.currency, settledAmountCents: m.settledAmountCents, review: !!reviewReason },
          },
        })
      } catch (e) {
        // Recorded meanwhile by a concurrent run: the unique reference refused the duplicate.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const again = await prisma.procurementDebit.findUnique({ where: { source_sourceReference: { source: "stripe_issuing", sourceReference: m.reference } }, select: { id: true } })
          if (again) idByRef.set(m.reference, again.id)
          continue
        }
        throw e
      }
      idByRef.set(m.reference, id)
      if (m.autoAllocateOrderId && m.settledAmountCents != null && !reviewReason) {
        const res = await allocateProcurementDebit(
          id,
          { orderId: m.autoAllocateOrderId, amountCents: m.settledAmountCents, basis: "single_order", note: "carte à usage unique de la commande" },
          ISSUING_IMPORT_ACTOR
        )
        if (res.ok) allocated += 1
        else allocationRefused.push({ reference: m.reference, error: res.error })
      }
    }
    // The checkpoint advances only when the whole window was read (a truncated run starts again from the same point).
    let checkpoint: number | null = null
    if (!truncated && lastCreated) {
      checkpoint = lastCreated
      await prisma.auditLog.upsert({
        where: { id: ISSUING_CHECKPOINT_ID },
        create: { id: ISSUING_CHECKPOINT_ID, action: "procurement_debit.issuing_checkpoint", entityType: "ProcurementDebit", actorId: ISSUING_IMPORT_ACTOR, payload: { lastCreated, at: now.toISOString() } },
        update: { payload: { lastCreated, at: now.toISOString() } },
      })
    }
    return { ok: true, applied: true, read: txs.length + unreadable, unreadable, plan: summary, recorded, allocated, allocationRefused, truncated, checkpoint }
  } catch (e) {
    if (isPrismaSchemaMissingError(e)) return { ok: false, error: "register_unavailable" }
    throw e
  }
}
