import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { defaultStoreNameFromSignup, slugFromStoreName } from "@/lib/store-slug"

async function slugAvailable(
  slug: string,
  excludeUserId?: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const found = await tx.store.findUnique({ where: { slug } })
  if (!found) return true
  if (excludeUserId && found.userId === excludeUserId) return true
  return false
}

export async function allocateUniqueSlug(
  name: string,
  excludeUserId?: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const base = slugFromStoreName(name)
  let slug = base
  let n = 0
  while (!(await slugAvailable(slug, excludeUserId, tx))) {
    n += 1
    slug = `${base}-${n}`.slice(0, 60)
  }
  return slug
}

export async function ensureMerchantStore(
  params: { userId: string; email: string; displayName?: string | null },
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const existing = await tx.store.findUnique({ where: { userId: params.userId } })
  if (existing) return existing

  const name = defaultStoreNameFromSignup(params.email, params.displayName ?? null)
  const slug = await allocateUniqueSlug(name, params.userId, tx)

  return tx.store.create({
    data: {
      userId: params.userId,
      name,
      slug,
    },
  })
}
