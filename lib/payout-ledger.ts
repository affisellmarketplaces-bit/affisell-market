import type { Prisma } from "@prisma/client"

import type { PayoutRail } from "@/lib/payout-settlement.shared"

type Tx = Prisma.TransactionClient

/**
 * One row of the merchant payout ledger, as written.
 *
 * WHY THIS MODULE NEVER CATCHES A UNIQUE VIOLATION (2026-11-25)
 * Every writer of the ledger runs inside an interactive Prisma transaction next to other writes (the transfer
 * attempt marked SUCCESS, the order's payout timestamp, the order marked PAID, the notification). In PostgreSQL a
 * unique violation ABORTS the whole transaction: catching Prisma's P2002 in JavaScript and carrying on does not make
 * the transaction usable again — the next statement is refused, and the final COMMIT turns into a ROLLBACK. The
 * former `create` + `catch P2002 → "already recorded"` therefore threw away the caller's other writes on a replay:
 * a transfer Stripe had really made could be left unreflected (attempt not SUCCESS, order not PAID), and retried.
 *
 * The insert is now `INSERT … ON CONFLICT DO NOTHING` (`createMany({ skipDuplicates: true })`), which never raises,
 * so the transaction stays usable. "Nothing inserted" is then PROVED to be a replay of the SAME entry (same
 * idempotency key, same beneficiary, amount, kind, transfer and order) before it is answered as such. Anything else —
 * the same key carrying a different entry, or the Stripe transfer already held by another entry — is an accounting
 * anomaly and is thrown (`PayoutLedgerConflictError`), so the caller's transaction rolls back loudly instead of
 * recording half of a payout. Every other database error (foreign key, connection, …) is never caught here.
 */
export type PayoutLedgerRow = {
  orderId: string | null
  blindDropshipOrderId: string | null
  userId: string
  beneficiaryRole: string
  entryType: string
  amountCents: number
  idempotencyKey: string
  stripeTransferId: string | null
  payoutRail: string
  note: string | null
}

export type PayoutLedgerConflictReason =
  /** A row already holds this idempotency key, but it is not the same entry (other amount, beneficiary, transfer…). */
  | "idempotency_key_mismatch"
  /** The Stripe transfer is already recorded under ANOTHER idempotency key: one transfer, two ledger entries. */
  | "stripe_transfer_taken"
  /** Nothing was inserted and no row explains it (a unique index this module does not know about). */
  | "unexplained_conflict"

export class PayoutLedgerConflictError extends Error {
  readonly code = "payout_ledger_conflict"

  constructor(
    readonly reason: PayoutLedgerConflictReason,
    readonly idempotencyKey: string,
    /** The fields that differ (names only — never values: they are amounts and account ids). */
    readonly differingFields: readonly string[] = []
  ) {
    super(
      `[payout-ledger] ${reason} for idempotency key ${idempotencyKey}` +
        (differingFields.length ? ` (differs on: ${differingFields.join(", ")})` : "")
    )
    this.name = "PayoutLedgerConflictError"
  }
}

const IDENTITY_FIELDS = [
  "orderId",
  "blindDropshipOrderId",
  "userId",
  "beneficiaryRole",
  "entryType",
  "amountCents",
  "stripeTransferId",
] as const

/** The fields on which a stored row and a new one must agree to be the same entry (note / rail / date may differ). */
export function payoutLedgerDifferences(
  stored: Pick<PayoutLedgerRow, (typeof IDENTITY_FIELDS)[number]>,
  incoming: Pick<PayoutLedgerRow, (typeof IDENTITY_FIELDS)[number]>
): string[] {
  const norm = (v: unknown) => (v === undefined ? null : v)
  return IDENTITY_FIELDS.filter((f) => norm(stored[f]) !== norm(incoming[f]))
}

/**
 * Insert one ledger row inside the caller's transaction, without ever aborting it.
 *  - `true`  = inserted now;
 *  - `false` = this exact entry was already recorded (a replay): the caller's other writes are kept;
 *  - throws `PayoutLedgerConflictError` when "already there" is not the same entry, and lets every other error through.
 */
export async function insertPayoutLedgerRow(tx: Tx, row: PayoutLedgerRow): Promise<boolean> {
  const { count } = await tx.merchantPayoutLedger.createMany({ data: [row], skipDuplicates: true })
  if (count === 1) return true

  const stored = await tx.merchantPayoutLedger.findUnique({
    where: { idempotencyKey: row.idempotencyKey },
    select: {
      orderId: true,
      blindDropshipOrderId: true,
      userId: true,
      beneficiaryRole: true,
      entryType: true,
      amountCents: true,
      stripeTransferId: true,
    },
  })
  if (stored) {
    const differing = payoutLedgerDifferences(stored, row)
    if (differing.length === 0) return false
    throw new PayoutLedgerConflictError("idempotency_key_mismatch", row.idempotencyKey, differing)
  }

  if (row.stripeTransferId) {
    const holder = await tx.merchantPayoutLedger.findUnique({
      where: { stripeTransferId: row.stripeTransferId },
      select: { id: true },
    })
    if (holder) throw new PayoutLedgerConflictError("stripe_transfer_taken", row.idempotencyKey)
  }
  throw new PayoutLedgerConflictError("unexplained_conflict", row.idempotencyKey)
}

export async function recordMerchantPayoutEntry(
  tx: Tx,
  args: {
    orderId?: string
    blindDropshipOrderId?: string
    userId: string
    beneficiaryRole: "SUPPLIER" | "AFFILIATE"
    amountCents: number
    idempotencyKey: string
    note: string
    entryType?: "PAYOUT" | "CLAWBACK"
    stripeTransferId?: string | null
    payoutRail?: PayoutRail
  }
): Promise<boolean> {
  if (args.amountCents < 1) return false
  if (!args.orderId && !args.blindDropshipOrderId) return false
  const stripeTransferId = args.stripeTransferId?.trim() || null
  return insertPayoutLedgerRow(tx, {
    orderId: args.orderId ?? null,
    blindDropshipOrderId: args.blindDropshipOrderId ?? null,
    userId: args.userId,
    beneficiaryRole: args.beneficiaryRole,
    entryType: args.entryType ?? "PAYOUT",
    amountCents: args.amountCents,
    idempotencyKey: args.idempotencyKey,
    stripeTransferId,
    payoutRail: args.payoutRail ?? (stripeTransferId ? "connect" : "ledger_only"),
    note: args.note,
  })
}
