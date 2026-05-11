import type { Prisma, PrismaClient } from "@prisma/client"

import { normalizeOrderEmail } from "@/lib/order-return-policy"

type Db = PrismaClient | Prisma.TransactionClient

/**
 * User id to credit with listing cashback: session metadata when logged in at checkout,
 * otherwise a single account matching the Stripe checkout email (if any).
 */
export async function resolveBuyerUserIdForEarn(
  db: Db,
  metaBuyerUserId: string,
  customerEmail: string
): Promise<string | null> {
  const fromMeta = metaBuyerUserId.trim()
  if (fromMeta) return fromMeta

  const norm = normalizeOrderEmail(customerEmail)
  if (!norm || norm === "unknown@checkout") return null

  const row = await db.user.findFirst({
    where: { email: { equals: norm, mode: "insensitive" } },
    select: { id: true },
  })
  return row?.id ?? null
}
