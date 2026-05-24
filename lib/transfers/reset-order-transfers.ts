import { prisma } from "@/lib/prisma"

export async function resetOrderTransferAttempts(orderId: string): Promise<void> {
  await prisma.transferAttempt.updateMany({
    where: { orderId, status: { not: "SUCCESS" } },
    data: {
      status: "PENDING",
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      stripeTransferId: null,
      lastAttemptAt: null,
    },
  })
  await prisma.order.update({
    where: { id: orderId },
    data: { splitStatus: "PENDING" },
  })
}
