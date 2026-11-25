import type { Prisma } from "@prisma/client"

import { recordStripePayoutSettlement } from "@/lib/payout-settlement"

/**
 * The ONE way a marketplace leg (supplier / reseller of an order) is recorded as paid, whatever rail paid it
 * (process-transfers, Lightning, or a reconciliation that adopted the transfer): the transfer attempt row becomes
 * SUCCESS with that transfer, and the ledger mirror is written (idempotent on the transfer id, PR #11).
 *
 * It never invents a payment: a SUCCESS attempt that already names ANOTHER transfer is an accounting conflict and is
 * thrown, so the caller's transaction (which also marks the leg PAID) rolls back loudly.
 */
export class MarketplaceLegRecordConflictError extends Error {
  readonly code = "marketplace_leg_record_conflict"
  constructor(readonly orderId: string, readonly role: "SUPPLIER" | "AFFILIATE") {
    super(`transfer attempt ${orderId}/${role} already SUCCESS with another transfer`)
    this.name = "MarketplaceLegRecordConflictError"
  }
}

export async function recordMarketplaceLegPaid(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string
    role: "SUPPLIER" | "AFFILIATE"
    amountCents: number
    destination: string
    stripeTransferId: string
    paidAt: Date
    rail: "connect" | "lightning"
    userId: string
    productName: string | null
    /** Attempt counter to store (the caller's own count); defaults to max(existing, 1). */
    attempts?: number
  }
): Promise<void> {
  const existing = await tx.transferAttempt.findUnique({
    where: { orderId_role: { orderId: args.orderId, role: args.role } },
    select: { status: true, stripeTransferId: true, attempts: true },
  })
  if (
    existing?.status === "SUCCESS" &&
    existing.stripeTransferId &&
    existing.stripeTransferId !== args.stripeTransferId
  ) {
    throw new MarketplaceLegRecordConflictError(args.orderId, args.role)
  }
  const attempts = args.attempts ?? Math.max(existing?.attempts ?? 0, 1)

  await tx.transferAttempt.upsert({
    where: { orderId_role: { orderId: args.orderId, role: args.role } },
    create: {
      orderId: args.orderId,
      role: args.role,
      amountCents: args.amountCents,
      destination: args.destination,
      status: "SUCCESS",
      stripeTransferId: args.stripeTransferId,
      attempts,
      lastAttemptAt: args.paidAt,
    },
    update: {
      amountCents: args.amountCents,
      destination: args.destination,
      status: "SUCCESS",
      stripeTransferId: args.stripeTransferId,
      errorCode: null,
      errorMessage: null,
      attempts,
      lastAttemptAt: args.paidAt,
    },
  })

  await recordStripePayoutSettlement(tx, {
    orderId: args.orderId,
    beneficiaryRole: args.role,
    userId: args.userId,
    amountCents: args.amountCents,
    stripeTransferId: args.stripeTransferId,
    payoutRail: args.rail,
    productName: args.productName,
    paidAt: args.paidAt,
  })
}
