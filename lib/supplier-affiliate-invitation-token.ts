import { randomBytes } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

/** Public invite slug prefix (supplier → affiliate). */
export const SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX = "IAF-"

export async function allocateUniqueSupplierAffiliateInviteToken(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const raw = randomBytes(9).toString("hex").slice(0, 12).toUpperCase()
    const token = `${SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX}${raw}`
    const clash = await tx.supplierAffiliateInvitation.findUnique({
      where: { token },
      select: { id: true },
    })
    if (!clash) return token
  }
  throw new Error("supplier_affiliate_invite_token_alloc_failed")
}

export function normalizeSupplierAffiliateInviteToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim().toUpperCase()
  if (!t.startsWith(SUPPLIER_AFFILIATE_INVITE_TOKEN_PREFIX)) return null
  if (t.length < 8 || t.length > 32) return null
  return t
}
