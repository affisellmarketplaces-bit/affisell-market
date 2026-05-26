import { randomBytes } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { SUPPLIER_INVITE_TOKEN_PREFIX } from "@/lib/supplier-invitation-token-shared"

export async function allocateUniqueSupplierInviteToken(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const raw = randomBytes(9).toString("hex").slice(0, 12).toUpperCase()
    const token = `${SUPPLIER_INVITE_TOKEN_PREFIX}${raw}`
    const clash = await tx.affiliateSupplierInvitation.findUnique({
      where: { token },
      select: { id: true },
    })
    if (!clash) return token
  }
  throw new Error("supplier_invite_token_alloc_failed")
}
