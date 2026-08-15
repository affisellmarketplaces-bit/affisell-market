import "server-only"

import {
  AFFILIATE_BOUTIQUE_OWNER_ROLE,
  affiliateBoutiquePublicPath,
  isAffiliateBoutiqueApiRole,
  supplierCatalogPublicPath,
} from "@/lib/boutique/reseller-boutique-access-shared"
import { prisma } from "@/lib/prisma"

export {
  AFFILIATE_BOUTIQUE_OWNER_ROLE,
  affiliateBoutiquePublicPath,
  isAffiliateBoutiqueApiRole,
  supplierCatalogPublicPath,
} from "@/lib/boutique/reseller-boutique-access-shared"

export type AffiliateBoutiqueStoreRecord = {
  slug: string
  name: string
  userId: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  description: string | null
  storefrontTheme: unknown
}

const affiliateBoutiqueStoreSelect = {
  slug: true,
  name: true,
  userId: true,
  logoUrl: true,
  aiAvatarUrl: true,
  description: true,
  storefrontTheme: true,
  user: { select: { role: true } },
} as const

/** Returns null when slug is missing, unknown, or owned by a non-affiliate (e.g. supplier). */
export async function loadAffiliateBoutiqueStoreBySlug(
  storeSlug: string
): Promise<AffiliateBoutiqueStoreRecord | null> {
  const slug = storeSlug.trim()
  if (!slug) return null

  const store = await prisma.store.findUnique({
    where: { slug },
    select: affiliateBoutiqueStoreSelect,
  })

  if (!store || store.user.role !== AFFILIATE_BOUTIQUE_OWNER_ROLE) {
    return null
  }

  return {
    slug: store.slug,
    name: store.name,
    userId: store.userId,
    logoUrl: store.logoUrl,
    aiAvatarUrl: store.aiAvatarUrl,
    description: store.description,
    storefrontTheme: store.storefrontTheme,
  }
}

export async function assertAffiliateBoutiqueStoreMatchesAffiliate(args: {
  storeSlug: string
  affiliateId: string
}): Promise<{ ok: true; storeUserId: string } | { ok: false }> {
  const store = await loadAffiliateBoutiqueStoreBySlug(args.storeSlug)
  if (!store || store.userId !== args.affiliateId.trim()) {
    return { ok: false }
  }
  return { ok: true, storeUserId: store.userId }
}
