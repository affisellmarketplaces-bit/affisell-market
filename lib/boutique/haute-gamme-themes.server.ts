import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { boutiqueTitleTypographyToStoreFields } from "@/lib/boutique/boutique-title-typography-shared"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"
import {
  buildHauteGammeBuyerTagline,
  buildHauteGammeHeroTitle,
  buildHauteGammeMerchantTagline,
  hauteGammeToBoutiqueTitleTypography,
  resolveStableDesignIndex,
  type BrandStudioSnapshot,
  type HauteGammeDesign,
} from "@/lib/boutique/haute-gamme-themes-shared"

export type { BrandStudioSnapshot, HauteGammeDesign } from "@/lib/boutique/haute-gamme-themes-shared"
export { matchVibeToDesign } from "@/lib/boutique/haute-gamme-themes-shared"

export async function loadBrandStudioCatalogTitles(userId: string): Promise<string[]> {
  const rows = await prisma.affiliateProduct.findMany({
    where: { affiliateId: userId, ...buyerListedAffiliateProductWhere },
    select: {
      customTitle: true,
      product: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  })

  return rows
    .map((row) => row.customTitle?.trim() || row.product?.name?.trim() || "")
    .filter(Boolean)
}

export function buildBrandStudioGeneration(args: {
  storeSlug: string
  vibe: string
  design: HauteGammeDesign
  locale?: string
}): BrandStudioSnapshot {
  const storeLabel = formatResellerStoreLabel(args.storeSlug)
  const merchantTagline = buildHauteGammeMerchantTagline({
    vibe: args.vibe,
    storeLabel,
  })
  const buyerTagline = buildHauteGammeBuyerTagline({
    design: args.design,
    storeLabel,
    locale: args.locale,
  })
  const heroTitle = buildHauteGammeHeroTitle({
    storeLabel,
    typography: args.design.typography,
  })

  return {
    designId: args.design.id,
    vibe: args.vibe.trim().slice(0, 400),
    merchantTagline,
    buyerTagline,
    palette: args.design.palette,
    typography: args.design.typography,
    heroTitle,
    designIndex: resolveStableDesignIndex(args.storeSlug, args.design.id),
    updatedAt: new Date().toISOString(),
  }
}

export async function persistBrandStudioSnapshot(args: {
  userId: string
  storeSlug: string
  snapshot: BrandStudioSnapshot
}): Promise<void> {
  const slug = args.storeSlug.trim()
  const store = await prisma.store.findUnique({
    where: { userId: args.userId },
    select: { id: true, slug: true, storefrontTheme: true },
  })

  if (!store || store.slug !== slug) {
    throw new Error("Store not found")
  }

  const existing = parseStorefrontTheme(store.storefrontTheme)
  const titleFields = boutiqueTitleTypographyToStoreFields(
    hauteGammeToBoutiqueTitleTypography(args.snapshot.typography)
  )

  await prisma.store.update({
    where: { id: store.id },
    data: {
      storefrontTheme: {
        ...existing,
        brandStudio: args.snapshot,
        boutiqueAiTagline: args.snapshot.buyerTagline,
        boutiqueTitleDisplay: args.snapshot.heroTitle,
        boutiqueTitleLayout: "custom-only",
        ...titleFields,
      },
    },
  })

  console.log("[brand-studio-generate]", {
    userId: args.userId,
    storeSlug: slug,
    designId: args.snapshot.designId,
    result: "persisted",
  })
}
