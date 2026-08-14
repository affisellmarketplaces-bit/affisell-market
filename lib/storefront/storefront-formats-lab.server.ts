import { cache } from "react"

import { DEMO_LAB_EMAIL_BY_PERSONA } from "@/lib/demo/demo-accounts-shared"
import { prisma } from "@/lib/prisma"
import type { StorefrontFormatsLabSlugs } from "@/lib/storefront/storefront-formats-catalog-shared"

const FALLBACK_AFFILIATE_SLUG = "ecom-store"

async function resolveAffiliateDemoSlug(): Promise<string | null> {
  const demoStore = await prisma.store.findFirst({
    where: { user: { email: DEMO_LAB_EMAIL_BY_PERSONA.affiliate } },
    select: { slug: true },
  })
  if (demoStore?.slug?.trim()) return demoStore.slug.trim()

  const fallback = await prisma.store.findUnique({
    where: { slug: FALLBACK_AFFILIATE_SLUG },
    select: { slug: true },
  })
  if (fallback?.slug?.trim()) return fallback.slug.trim()

  const anyAffiliate = await prisma.store.findFirst({
    where: { user: { role: "AFFILIATE" } },
    orderBy: { updatedAt: "desc" },
    select: { slug: true },
  })
  return anyAffiliate?.slug?.trim() || null
}

export const loadStorefrontFormatsLabSlugs = cache(async function loadStorefrontFormatsLabSlugs(): Promise<StorefrontFormatsLabSlugs> {
  const [affiliateStoreSlug, supplierStore, legionProfile] = await Promise.all([
    resolveAffiliateDemoSlug(),
    prisma.store.findFirst({
      where: { user: { email: DEMO_LAB_EMAIL_BY_PERSONA.supplier } },
      select: { slug: true },
    }),
    prisma.storeProfile.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { username: true },
    }),
  ])

  const slugs: StorefrontFormatsLabSlugs = {
    affiliateStoreSlug,
    supplierStoreSlug: supplierStore?.slug?.trim() || null,
    legionUsername: legionProfile?.username?.trim() || null,
  }

  console.log("[storefront-formats-lab]", slugs)
  return slugs
})
