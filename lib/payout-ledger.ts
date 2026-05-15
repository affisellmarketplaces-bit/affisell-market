import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

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
  }
): Promise<boolean> {
  if (args.amountCents < 1) return false
  if (!args.orderId && !args.blindDropshipOrderId) return false
  try {
    await tx.merchantPayoutLedger.create({
      data: {
        orderId: args.orderId ?? null,
        blindDropshipOrderId: args.blindDropshipOrderId ?? null,
        userId: args.userId,
        beneficiaryRole: args.beneficiaryRole,
        entryType: args.entryType ?? "PAYOUT",
        amountCents: args.amountCents,
        idempotencyKey: args.idempotencyKey,
        note: args.note,
      },
    })
    return true
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") return false
    throw e
  }
}
