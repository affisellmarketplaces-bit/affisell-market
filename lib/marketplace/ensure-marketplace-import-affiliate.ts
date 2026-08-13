import "server-only"

import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const MARKETPLACE_IMPORT_AFFILIATE_EMAIL = "marketplace-import@affisell.internal"
export const MARKETPLACE_IMPORT_AFFILIATE_NAME = "Affisell Marketplace"

export type MarketplaceImportAffiliate = {
  id: string
  email: string
  storeSlug: string
}

/** Platform affiliate that owns marketplace 1-clic import listings. */
export async function ensureMarketplaceImportAffiliate(): Promise<MarketplaceImportAffiliate> {
  const existing = await prisma.user.findUnique({
    where: { email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL },
    select: {
      id: true,
      role: true,
      store: { select: { slug: true } },
    },
  })

  if (existing) {
    if (existing.role !== "AFFILIATE") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "AFFILIATE", name: MARKETPLACE_IMPORT_AFFILIATE_NAME },
      })
    }
    const store = await ensureMerchantStore({
      userId: existing.id,
      email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
      displayName: MARKETPLACE_IMPORT_AFFILIATE_NAME,
    })
    return {
      id: existing.id,
      email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
      storeSlug: store.slug,
    }
  }

  const created = await prisma.user.create({
    data: {
      email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
      name: MARKETPLACE_IMPORT_AFFILIATE_NAME,
      role: "AFFILIATE",
      emailVerified: new Date(),
    },
    select: { id: true },
  })

  const store = await ensureMerchantStore({
    userId: created.id,
    email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
    displayName: MARKETPLACE_IMPORT_AFFILIATE_NAME,
  })

  return {
    id: created.id,
    email: MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
    storeSlug: store.slug,
  }
}
