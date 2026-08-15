import { listingDisplayTitle, listingGalleryUrls, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import type { AffiliateVariantPricingMap } from "@/lib/affiliate-variant-pricing"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { stripDescriptionImageMarkers } from "@/lib/description-rich-content"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import type { ProductVariantsJson } from "@/lib/product-variants"
import { prisma } from "@/lib/prisma"
import type { CustomColumn } from "@/types/product"
import {
  formatResellerStoreLabel,
  type ResellerStorefrontListProduct,
} from "@/lib/boutique/reseller-storefront-shared"
import {
  prepareResellerListingVariantContext,
  resolveResellerDefaultListingCommerce,
  resolveResellerListingColorImages,
  resolveResellerListingCommerce,
  summarizeResellerListingVariants,
} from "@/lib/boutique/reseller-listing-commerce.server"
import {
  formatResellerPriceFromLabel,
  type ResellerListingVariantSummary,
} from "@/lib/boutique/reseller-listing-variants-shared"
import {
  serializeResellerBoutiqueTheme,
  type ResellerBoutiqueThemeProps,
} from "@/lib/boutique/reseller-boutique-theme-shared"
import { parseBoutiqueTitleTypography } from "@/lib/boutique/boutique-title-typography-shared"
import type { BrandStudioSnapshot } from "@/lib/boutique/haute-gamme-themes-shared"
import { parseBrandStudioSnapshot, resolvePublicBoutiqueTagline } from "@/lib/boutique/haute-gamme-themes-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
export { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"

export type ResellerStorefrontProduct = {
  listingId: string
  title: string
  descriptionExcerpt: string
  imageUrl: string
  priceLabel: string
  /** Variant-aware unit price (same source as marketplace PDP default selection). */
  priceCents: number
  isOutOfStock: boolean
  stockLabel: string
  marketplaceHref: string
}

export type ResellerBoutiqueProductDetail = ResellerStorefrontProduct & {
  /** Catalog product id — wishlist / gallery overlays. */
  catalogProductId: string
  listingPriceCents: number
  basePriceCents: number
  variantPricing: AffiliateVariantPricingMap | null
  colorNames: string[]
  colorImages: ProductColorImageRow[]
  storageOptions: string[]
  sizeOptions: string[]
  variants: ProductVariantsJson | null
  customColumns: CustomColumn[]
  variantSummary: ResellerListingVariantSummary
  gallery: string[]
  catalogStock: number
  defaultSelection: {
    selectedColor: string | null
    selectedSize: string | null
    selectedStorage: string | null
  }
}

export { resolveResellerDefaultListingCommerce, resolveResellerListingCommerce } from "@/lib/boutique/reseller-listing-commerce.server"

const listingProductSelect = {
  stock: true,
  basePriceCents: true,
  variants: true,
  colors: true,
  customColumns: true,
  colorImages: true,
  images: true,
  productVariants: {
    select: {
      id: true,
      color: true,
      size: true,
      stock: true,
      customData: true,
      supplierPrice: true,
      wholesalePriceCents: true,
    },
  },
} as const

function mapResellerProductDetail(args: {
  listing: {
    id: string
    productId: string
    customTitle: string | null
    customDescription: string | null
    sellingPriceCents: number
    variantPricing: unknown
    promotedVariantKeys: string[] | null
    customImages: string[]
    product: {
      name: string
      description: string | null
      images: string[]
      stock: number
      basePriceCents: number
      variants: unknown
      colors: string[]
      customColumns: unknown
      colorImages?: unknown
      productVariants: Array<{
        id: string
        color: string | null
        size: string | null
        stock: number
        customData: unknown
        supplierPrice: unknown
        wholesalePriceCents?: number | null
      }>
    }
  }
}): ResellerBoutiqueProductDetail {
  const { listing } = args
  const productShape = {
    basePriceCents: listing.product.basePriceCents,
    stock: listing.product.stock,
    variants: listing.product.variants,
    colors: listing.product.colors ?? [],
    customColumns: listing.product.customColumns,
    colorImages: listing.product.colorImages,
    productVariants: listing.product.productVariants ?? [],
  }

  const ctx = prepareResellerListingVariantContext({
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: productShape,
  })

  const commerce = resolveResellerListingCommerce({
    listingSellingPriceCents: listing.sellingPriceCents,
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: productShape,
  })

  const variantSummary = summarizeResellerListingVariants({
    listingSellingPriceCents: listing.sellingPriceCents,
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: productShape,
  })

  const colorImages = resolveResellerListingColorImages({
    product: productShape,
    colorNames: ctx.colorNames,
  })

  const isOutOfStock = commerce.availableStock <= 0
  const stockLabel = isOutOfStock ? "Rupture de stock" : "En stock"
  const priceFromLabel = formatResellerPriceFromLabel(variantSummary, formatStoreCurrencyFromCents)

  const rawDescription = listing.customDescription?.trim() || listing.product.description || ""
  const plainDescription = stripDescriptionImageMarkers(rawDescription).replace(/\s+/g, " ").trim()
  const gallery = listingGalleryUrls(listing.customImages, listing.product.images)

  return {
    listingId: listing.id,
    catalogProductId: listing.productId,
    title: listingDisplayTitle(listing.customTitle, listing.product.name),
    descriptionExcerpt: plainDescription.slice(0, 420),
    imageUrl: gallery[0] || "/placeholder.png",
    priceLabel: priceFromLabel ?? formatStoreCurrencyFromCents(commerce.priceCents),
    priceCents: commerce.priceCents,
    isOutOfStock,
    stockLabel,
    marketplaceHref: `/marketplace/${listing.id}`,
    listingPriceCents: listing.sellingPriceCents,
    basePriceCents: listing.product.basePriceCents,
    variantPricing: ctx.variantPricing,
    colorNames: ctx.colorNames,
    colorImages,
    storageOptions: ctx.storageOptions,
    sizeOptions: ctx.sizeOptions,
    variants: ctx.variants,
    customColumns: ctx.customColumns,
    variantSummary,
    gallery: gallery.length > 0 ? gallery : ["/placeholder.png"],
    catalogStock: listing.product.stock,
    defaultSelection: {
      selectedColor: commerce.selectedColor,
      selectedSize: commerce.selectedSize,
      selectedStorage: commerce.selectedStorage,
    },
  }
}

export async function loadResellerBoutiqueProductDetail(
  listingId: string | null | undefined
): Promise<ResellerBoutiqueProductDetail | null> {
  const id = listingId?.trim()
  if (!id) return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      productId: true,
      customTitle: true,
      customDescription: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      customImages: true,
      product: {
        select: {
          ...listingProductSelect,
          name: true,
          description: true,
        },
      },
    },
  })

  if (!listing?.product) return null

  const detail = mapResellerProductDetail({ listing })

  console.log("[boutique-storefront]", {
    listingId: listing.id,
    optionCount: detail.variantSummary.optionCount,
    hasMultipleOptions: detail.variantSummary.hasMultipleOptions,
    priceCents: detail.priceCents,
    isOutOfStock: detail.isOutOfStock,
    result: "detail_loaded",
  })

  return detail
}

export async function loadResellerStorefrontProduct(
  listingId: string | null | undefined
): Promise<ResellerStorefrontProduct | null> {
  const detail = await loadResellerBoutiqueProductDetail(listingId)
  if (!detail) return null

  return {
    listingId: detail.listingId,
    title: detail.title,
    descriptionExcerpt: detail.descriptionExcerpt,
    imageUrl: detail.imageUrl,
    priceLabel: detail.priceLabel,
    priceCents: detail.priceCents,
    isOutOfStock: detail.isOutOfStock,
    stockLabel: detail.stockLabel,
    marketplaceHref: detail.marketplaceHref,
  }
}

export type ResellerBoutiqueStoreContext = {
  storeSlug: string
  storeName: string
  storeLabel: string
  ownerUserId: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  tagline: string | null
  /** Merchant-saved procedural theme for /boutique (t-XXXX). */
  boutiqueVisualTheme: string | null
  /** Haute gamme design synced from Brand Studio. */
  brandStudio: BrandStudioSnapshot | null
  titleTypography: ReturnType<typeof parseBoutiqueTitleTypography>
  theme: ResellerBoutiqueThemeProps
}

export async function loadResellerBoutiqueStoreContext(
  storeSlug: string
): Promise<ResellerBoutiqueStoreContext | null> {
  const slug = storeSlug.trim()
  if (!slug) return null

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      userId: true,
      logoUrl: true,
      aiAvatarUrl: true,
      description: true,
      storefrontTheme: true,
    },
  })

  if (!store) return null

  const parsedTheme = parseStorefrontTheme(store.storefrontTheme)
  const boutiqueAiTagline = parsedTheme.boutiqueAiTagline?.trim() || null
  const boutiqueVisualTheme = parsedTheme.boutiqueVisualTheme?.trim() || null
  const storeLabel = formatResellerStoreLabel(store.slug)
  const brandStudio =
    parseBrandStudioSnapshot(parsedTheme.brandStudio, { storeLabel }) ??
    null

  return {
    storeSlug: store.slug,
    storeName: store.name,
    storeLabel,
    ownerUserId: store.userId,
    logoUrl: store.logoUrl?.trim() || null,
    aiAvatarUrl: store.aiAvatarUrl?.trim() || null,
    tagline: resolvePublicBoutiqueTagline({
      brandStudio,
      boutiqueAiTagline,
      storeDescription: store.description?.trim() ?? null,
      storeLabel,
    }),
    boutiqueVisualTheme,
    brandStudio,
    titleTypography: parseBoutiqueTitleTypography(parsedTheme),
    theme: serializeResellerBoutiqueTheme(parsedTheme),
  }
}

export type ResellerStorefrontListOwner = {
  id: string
  storeName: string
  storeSlug: string
}

export type ResellerStorefrontListResult = {
  owner: ResellerStorefrontListOwner | null
  products: ResellerStorefrontListProduct[]
  count: number
  theme: ResellerBoutiqueThemeProps
}

export async function loadResellerStorefrontList(args: {
  storeSlug: string
}): Promise<ResellerStorefrontListResult> {
  const storeSlug = args.storeSlug.trim()
  if (!storeSlug) {
    return {
      owner: null,
      products: [],
      count: 0,
      theme: serializeResellerBoutiqueTheme(parseStorefrontTheme(null)),
    }
  }

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: {
      slug: true,
      name: true,
      userId: true,
      storefrontTheme: true,
    },
  })

  if (!store) {
    console.log("[boutique-storefront-list]", { storeSlug, result: "store_not_found" })
    return {
      owner: null,
      products: [],
      count: 0,
      theme: serializeResellerBoutiqueTheme(parseStorefrontTheme(null)),
    }
  }

  const theme = serializeResellerBoutiqueTheme(parseStorefrontTheme(store.storefrontTheme))

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: store.userId,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      productId: true,
      customTitle: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      customImages: true,
      conversions: true,
      isFeatured: true,
      buyerRewardKind: true,
      buyerRewardPercent: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          stock: true,
          basePriceCents: true,
          compareAt: true,
          variants: true,
          colors: true,
          customColumns: true,
          productVariants: {
            select: {
              id: true,
              color: true,
              size: true,
              stock: true,
              customData: true,
              supplierPrice: true,
              wholesalePriceCents: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  const bestSellerIds = new Set(
    [...listings]
      .filter((row) => row.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 3)
      .map((row) => row.id)
  )

  const products: ResellerStorefrontListProduct[] = listings
    .filter((listing): listing is typeof listing & { product: NonNullable<typeof listing.product> } =>
      Boolean(listing.product)
    )
    .map((listing) => {
      const productShape = {
        basePriceCents: listing.product.basePriceCents,
        stock: listing.product.stock,
        variants: listing.product.variants,
        colors: listing.product.colors ?? [],
        customColumns: listing.product.customColumns,
        productVariants: listing.product.productVariants ?? [],
      }

      const commerce = resolveResellerDefaultListingCommerce({
        listingSellingPriceCents: listing.sellingPriceCents,
        variantPricingRaw: listing.variantPricing,
        promotedVariantKeys: listing.promotedVariantKeys,
        product: productShape,
      })

      const variantSummary = summarizeResellerListingVariants({
        listingSellingPriceCents: listing.sellingPriceCents,
        variantPricingRaw: listing.variantPricing,
        promotedVariantKeys: listing.promotedVariantKeys,
        product: productShape,
      })

      const ctx = prepareResellerListingVariantContext({
        variantPricingRaw: listing.variantPricing,
        promotedVariantKeys: listing.promotedVariantKeys,
        product: productShape,
      })

      const priceFromLabel = formatResellerPriceFromLabel(variantSummary, formatStoreCurrencyFromCents)

      return {
        id: listing.id,
        productId: listing.productId,
        title: listingDisplayTitle(listing.customTitle, listing.product.name),
        priceCents: commerce.priceCents,
        priceLabel: priceFromLabel ?? formatStoreCurrencyFromCents(commerce.priceCents),
        compareAtCents:
          listing.product.compareAt != null
            ? Math.round(Number(listing.product.compareAt) * 100)
            : null,
        image: listingPrimaryImageUrl(listing.customImages, listing.product.images) || "/placeholder.png",
        isOutOfStock: commerce.availableStock <= 0,
        soldCount: listing.conversions,
        isBestSeller: listing.isFeatured || bestSellerIds.has(listing.id),
        buyerRewardBadge: buyerRewardBadgeText(
          normalizeBuyerRewardKind(listing.buyerRewardKind),
          listing.buyerRewardPercent
        ),
        variantSummary,
        colorSwatchNames: ctx.colorNames.slice(0, 8),
      }
    })

  console.log("[boutique-storefront-list]", {
    storeSlug,
    ownerId: store.userId,
    count: products.length,
    result: "loaded",
  })

  return {
    owner: {
      id: store.userId,
      storeName: store.name,
      storeSlug: store.slug,
    },
    products,
    count: products.length,
    theme,
  }
}
