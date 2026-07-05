import type { TransferReversalStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type TransferReversalAuditRow = {
  id: string
  orderId: string
  stripeRefundId: string
  stripeTransferId: string
  stripeReversalId: string | null
  role: string
  requestedCents: number
  amountCents: number
  status: TransferReversalStatus
  failureReason: string | null
  createdAt: Date
}

/** Read persisted reversal audit for an order (Phase 4 persistence). */
export async function listTransferReversalsForOrder(
  orderId: string
): Promise<TransferReversalAuditRow[]> {
  const rows = await prisma.transferReversal.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderId: true,
      stripeRefundId: true,
      stripeTransferId: true,
      stripeReversalId: true,
      role: true,
      requestedCents: true,
      amountCents: true,
      status: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({
    ...row,
    failureReason: row.status === "FAILED" ? row.errorMessage : null,
  }))
}

export async function countTransferReversalsByStatus(orderId: string): Promise<
  Record<TransferReversalStatus, number>
> {
  const grouped = await prisma.transferReversal.groupBy({
    by: ["status"],
    where: { orderId },
    _count: { _all: true },
  })

  return {
    SUCCESS: grouped.find((g) => g.status === "SUCCESS")?._count._all ?? 0,
    PARTIAL: grouped.find((g) => g.status === "PARTIAL")?._count._all ?? 0,
    FAILED: grouped.find((g) => g.status === "FAILED")?._count._all ?? 0,
  }
}
