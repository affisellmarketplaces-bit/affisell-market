import { prisma } from "@/lib/prisma"

/** Bump cart activity + allow a future abandonment email after idle time. */
export async function resetCartAbandonmentOnActivity(cartId: string): Promise<void> {
  await prisma.cart.update({
    where: { id: cartId },
    data: {
      updatedAt: new Date(),
      cartAbandonmentEmailSentAt: null,
    },
  })
}
