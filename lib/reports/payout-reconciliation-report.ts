/**
 * Database side of `npm run report:payout-reconciliation` — READ-ONLY. Runs inside the read-only runner's transaction
 * (`SET TRANSACTION READ ONLY` + a client that refuses every write). Relative imports only (scripts load it without the
 * Next path aliases).
 */
import type { Prisma } from "@prisma/client"

import type { RecAttempt, RecLedger, RecLeg, RecOrderRef } from "../payouts/reconciliation"

export type PayoutReconciliationDbFacts = {
  since: Date
  registryAvailable: boolean
  legs: RecLeg[]
  attempts: RecAttempt[]
  ledger: RecLedger[]
  orderRefs: RecOrderRef[]
  truncated: boolean
}

const CAP = 20_000

export async function collectPayoutReconciliationFacts(
  tx: Prisma.TransactionClient,
  opts: { since: Date }
): Promise<PayoutReconciliationDbFacts> {
  // Checked first: a query on a missing table would abort the read-only transaction.
  const reg = await tx.$queryRaw<{ r: string | null }[]>`SELECT to_regclass('"PayoutLeg"')::text AS r`
  const registryAvailable = Boolean(reg[0]?.r)

  const legs: RecLeg[] = registryAvailable
    ? (
        await tx.payoutLeg.findMany({
          take: CAP,
          orderBy: { createdAt: "desc" },
          select: {
            legKey: true,
            kind: true,
            role: true,
            orderId: true,
            state: true,
            stripeTransferId: true,
            amountCents: true,
            destination: true,
            inDoubtReason: true,
          },
        })
      ).map((l) => ({ ...l }))
    : []

  const attempts = await tx.transferAttempt.findMany({
    where: { createdAt: { gte: opts.since }, OR: [{ status: "SUCCESS" }, { stripeTransferId: { not: null } }] },
    take: CAP,
    select: { orderId: true, role: true, status: true, stripeTransferId: true, amountCents: true, destination: true },
  })

  const ledger = await tx.merchantPayoutLedger.findMany({
    where: { createdAt: { gte: opts.since }, entryType: { in: ["PAYOUT", "LEGION_OVERRIDE"] } },
    take: CAP,
    select: { orderId: true, beneficiaryRole: true, entryType: true, stripeTransferId: true, amountCents: true, payoutRail: true },
  })

  const orders = await tx.order.findMany({
    where: { paidAt: { gte: opts.since } },
    take: CAP,
    select: { id: true, stripeTransferId: true, payoutTransferIds: true },
  })
  const orderRefs: RecOrderRef[] = orders
    .map((o) => ({
      orderId: o.id,
      stripeTransferId: o.stripeTransferId,
      payoutTransferIds: Array.isArray(o.payoutTransferIds)
        ? (o.payoutTransferIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    }))
    .filter((o) => o.stripeTransferId || o.payoutTransferIds.length > 0)

  return {
    since: opts.since,
    registryAvailable,
    legs,
    attempts: attempts.map((a) => ({ ...a, role: a.role as "SUPPLIER" | "AFFILIATE" })),
    ledger,
    orderRefs,
    truncated: [legs.length, attempts.length, ledger.length, orders.length].some((n) => n >= CAP),
  }
}
