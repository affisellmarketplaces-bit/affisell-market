import { computeBrandPulse, type BrandPulseResult } from "@/lib/storefront-brand-pulse-shared"
import { DEFAULT_HOMEPAGE_SECTIONS } from "@/lib/storefront-sections-shared"
import { DEFAULT_STATIC_PAGES } from "@/lib/storefront-static-pages-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export type StoreBrandPulseSnapshot = {
  storeId: string
  userId: string
  email: string
  name: string | null
  role: "AFFILIATE" | "SUPPLIER"
  brandStudioPath: string
  pulse: BrandPulseResult
}

export async function buildStoreBrandPulseSnapshot(args: {
  store: {
    id: string
    userId: string
    name: string
    description: string | null
    logoUrl: string | null
    bannerUrl: string | null
    customDomain: string | null
    domainVerified: boolean
    storefrontTheme: unknown
  }
  user: { email: string; name: string | null; role: string }
  liveCatalogCount: number
}): Promise<StoreBrandPulseSnapshot> {
  const role = args.user.role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const theme = parseStorefrontTheme(args.store.storefrontTheme)

  const pulse = computeBrandPulse({
    name: args.store.name,
    description: args.store.description ?? "",
    logoUrl: args.store.logoUrl ?? "",
    bannerUrl: args.store.bannerUrl ?? "",
    presetId: theme.presetId ?? null,
    layout: theme.layout ?? "classic",
    heroStyle: theme.heroStyle ?? "banner",
    heroVideoUrl: theme.heroVideoUrl ?? "",
    surface: theme.surface ?? "light",
    embedEnabled: theme.embedWidget?.enabled ?? false,
    homepageSections: theme.homepageSections ?? DEFAULT_HOMEPAGE_SECTIONS,
    staticPages: theme.staticPages ?? DEFAULT_STATIC_PAGES,
    liveCatalogCount: args.liveCatalogCount,
    customDomainVerified: Boolean(args.store.customDomain && args.store.domainVerified),
    role,
  })

  return {
    storeId: args.store.id,
    userId: args.store.userId,
    email: args.user.email,
    name: args.user.name,
    role,
    brandStudioPath:
      role === "SUPPLIER" ? "/dashboard/supplier/storefront" : "/dashboard/affiliate/brand-studio",
    pulse,
  }
}

export async function countLiveCatalogForMerchant(
  userId: string,
  role: "AFFILIATE" | "SUPPLIER"
): Promise<number> {
  if (role === "AFFILIATE") {
    return prisma.affiliateProduct.count({
      where: { affiliateId: userId, isListed: true },
    })
  }
  return prisma.product.count({
    where: { supplierId: userId, active: true, isDraft: false },
  })
}
