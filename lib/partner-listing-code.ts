import { randomBytes } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

/**
 * Allocates a collision-resistant opaque code (AFS-…) for `Store.partnerListingCode`.
 */
export async function allocateUniquePartnerListingCode(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const raw = randomBytes(8).toString("hex").slice(0, 10).toUpperCase()
    const code = `AFS-${raw}`
    const clash = await tx.store.findUnique({ where: { partnerListingCode: code }, select: { id: true } })
    if (!clash) return code
  }
  throw new Error("partner_listing_code_alloc_failed")
}
