import "server-only"

import { listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { loadProductCrossSocialProofCached } from "@/lib/product-social-proof.server"
import type { ProductSocialProofData } from "@/lib/product-social-proof-shared"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { publicPartnerSellerLabel, publicSupplierVendorLabel } from "@/lib/public-seller-display"
import {
  buildParasiteProductPath,
  parseParasiteProductSegment,
} from "@/lib/seo-parasite-shared"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export type SeoParasitePageData = {
  affiliateSlug: string
  shopName: string
  productId: string
  productName: string
  productDescription: string | null
  imageUrl: string | null
  marginCents: number
  sellingPriceCents: number
  supplierName: string
  listingId: string
  canonicalPath: string
  canonicalUrl: string
  socialProof: ProductSocialProofData
}

export type SeoParasiteSitemapRow = {
  affiliateSlug: string
  productName: string
  productId: string
  updatedAt: Date
}

export async function loadSeoParasitePageData(
  affiliateSlug: string,
  productSegment: string
): Promise<SeoParasitePageData | null> {
  const slug = affiliateSlug.trim()
  const parsed = parseParasiteProductSegment(productSegment)
  if (!slug || !parsed) return null

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      userId: true,
      user: { select: { role: true, name: true } },
    },
  })

  if (!store || store.user.role !== "AFFILIATE") return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      affiliateId: store.userId,
      productId: parsed.productId,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      marginCents: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          images: true,
          basePriceCents: true,
          supplier: {
            select: {
              name: true,
              store: { select: { name: true } },
              merchantLegalProfile: {
                select: { tradeName: true, legalEntityName: true },
              },
            },
          },
        },
      },
    },
  })

  if (!listing?.product) return null

  const productName = listing.customTitle?.trim() || listing.product.name
  const canonicalPath = buildParasiteProductPath(slug, productName, listing.product.id)
  const baseUrl = resolveSiteBaseUrl().replace(/\/$/, "")

  const socialProof = await loadProductCrossSocialProofCached(listing.product.id)

  return {
    affiliateSlug: slug,
    shopName: publicPartnerSellerLabel({
      storeName: store.name,
      affiliateDisplayName: store.user.name,
    }),
    productId: listing.product.id,
    productName,
    productDescription: listing.product.description,
    imageUrl: listingPrimaryImageUrl(listing.customImages, listing.product.images) || null,
    marginCents: listing.marginCents,
    sellingPriceCents: listing.sellingPriceCents,
    supplierName: publicSupplierVendorLabel({
      storeName: listing.product.supplier.store?.name,
      tradeName: listing.product.supplier.merchantLegalProfile?.tradeName,
      legalEntityName: listing.product.supplier.merchantLegalProfile?.legalEntityName,
    }),
    listingId: listing.id,
    canonicalPath,
    canonicalUrl: `${baseUrl}${canonicalPath}`,
    socialProof,
  }
}

export async function loadSeoParasiteSitemapRows(limit = 5000): Promise<SeoParasiteSitemapRow[]> {
  if (!process.env.DATABASE_URL?.trim()) return []

  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: buyerListedAffiliateProductWhere,
      select: {
        updatedAt: true,
        customTitle: true,
        product: { select: { id: true, name: true } },
        affiliate: {
          select: {
            store: { select: { slug: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    })
  )

  return rows
    .filter((row) => row.affiliate.store?.slug)
    .map((row) => ({
      affiliateSlug: row.affiliate.store!.slug,
      productName: row.customTitle?.trim() || row.product.name,
      productId: row.product.id,
      updatedAt: row.updatedAt,
    }))
}

export function buildSeoParasiteSitemapXml(rows: SeoParasiteSitemapRow[], baseUrl?: string): string {
  const base = (baseUrl ?? resolveSiteBaseUrl()).replace(/\/$/, "")
  const urls = rows
    .map((row) => {
      const loc = `${base}${buildParasiteProductPath(row.affiliateSlug, row.productName, row.productId)}`
      const lastmod = row.updatedAt.toISOString()
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
