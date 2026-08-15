import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { filterListingForPromotedVariants } from "@/lib/affiliate-storefront-variants"
import {
  lookupVariantPricingEntry,
  parseAffiliateVariantPricingJson,
  resolveAffiliateSellingPriceCentsForOption,
} from "@/lib/affiliate-variant-pricing"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import {
  buildVariantOptionLabel,
  resolveListingAvailableStock,
} from "@/lib/marketplace-purchase-quantity"
import {
  collectStorageOptionValues,
  findVariantRowForShopperSelection,
  resolveMarketplacePrimaryOptionNames,
  variantsWithProductVariantRows,
} from "@/lib/marketplace-variant-dimensions"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { stripDescriptionImageMarkers } from "@/lib/description-rich-content"
import { parseCustomColumnsFromDb } from "@/lib/product-custom-columns"
import { variantsFromDb } from "@/lib/product-variants"
import { prisma } from "@/lib/prisma"
import {
  formatResellerStoreLabel,
  type ResellerStorefrontListProduct,
} from "@/lib/boutique/reseller-storefront-shared"
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

type ResellerListingCommerce = {
  priceCents: number
  availableStock: number
  defaultOptionName: string | null
}

/** Mirrors marketplace PDP default color/size + activeVariantRow pricing & stock. */
export function resolveResellerDefaultListingCommerce(args: {
  listingSellingPriceCents: number
  variantPricingRaw: unknown
  promotedVariantKeys: string[] | null | undefined
  product: {
    basePriceCents: number
    stock: number
    variants: unknown
    colors: string[]
    customColumns: unknown
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
}): ResellerListingCommerce {
  const customCols = parseCustomColumnsFromDb(args.product.customColumns)
  const variantsRaw = variantsWithProductVariantRows(
    variantsFromDb(args.product.variants),
    args.product.productVariants ?? [],
    customCols,
    args.product.basePriceCents
  )
  const storageOptionsRaw = collectStorageOptionValues({
    variants: variantsRaw,
    customColumns: customCols,
    productVariantCustomData: args.product.productVariants?.map((v) => v.customData),
  })
  const colorNamesRaw = resolveMarketplacePrimaryOptionNames(
    args.product.colors.filter((c) => Boolean(c.trim())),
    variantsRaw,
    storageOptionsRaw
  )
  const { variants, colorNames } = filterListingForPromotedVariants({
    variants: variantsRaw,
    colorNames: colorNamesRaw,
    promotedVariantKeys: args.promotedVariantKeys,
  })
  const storageOptions = collectStorageOptionValues({
    variants,
    customColumns: customCols,
    productVariantCustomData: args.product.productVariants?.map((v) => v.customData),
  })

  const selectedColor = colorNames[0] ?? null
  const sizeOptions = variants?.size?.length ? variants.size : []
  const selectedSize = sizeOptions[0] ?? null
  const selectedStorage = storageOptions[0] ?? null

  const activeVariantRow = findVariantRowForShopperSelection({
    variants,
    customColumns: customCols,
    selection: {
      selectedPrimary: selectedColor,
      selectedStorage,
      selectedSize,
    },
  })

  const variantPricing = parseAffiliateVariantPricingJson(args.variantPricingRaw)
  const labeledOption = buildVariantOptionLabel(selectedColor, selectedSize)
  const defaultOptionName =
    activeVariantRow?.name?.trim() ||
    (labeledOption && lookupVariantPricingEntry(variantPricing, labeledOption) ? labeledOption : null) ||
    selectedColor ||
    Object.keys(variantPricing)[0] ||
    null

  const priceCents = resolveAffiliateSellingPriceCentsForOption({
    listingSellingPriceCents: args.listingSellingPriceCents,
    productBasePriceCents: args.product.basePriceCents,
    variants,
    optionName: defaultOptionName,
    variantPricing,
  })

  const availableStock = activeVariantRow
    ? Math.max(0, Math.round(activeVariantRow.stock) || 0)
    : resolveListingAvailableStock({
        productStock: args.product.stock,
        variants,
        selectedColor,
        selectedSize,
      })

  return { priceCents, availableStock, defaultOptionName }
}

export async function loadResellerStorefrontProduct(
  listingId: string | null | undefined
): Promise<ResellerStorefrontProduct | null> {
  const id = listingId?.trim()
  if (!id) return null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      ...buyerListedAffiliateProductWhere,
    },
    select: {
      id: true,
      customTitle: true,
      customDescription: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      customImages: true,
      product: {
        select: {
          name: true,
          description: true,
          images: true,
          stock: true,
          basePriceCents: true,
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
  })

  if (!listing?.product) return null

  const commerce = resolveResellerDefaultListingCommerce({
    listingSellingPriceCents: listing.sellingPriceCents,
    variantPricingRaw: listing.variantPricing,
    promotedVariantKeys: listing.promotedVariantKeys,
    product: {
      basePriceCents: listing.product.basePriceCents,
      stock: listing.product.stock,
      variants: listing.product.variants,
      colors: listing.product.colors ?? [],
      customColumns: listing.product.customColumns,
      productVariants: listing.product.productVariants ?? [],
    },
  })

  const isOutOfStock = commerce.availableStock <= 0
  const stockLabel = isOutOfStock ? "Out of stock" : "En stock"

  console.log("[boutique-storefront]", {
    listingId: listing.id,
    defaultOptionName: commerce.defaultOptionName,
    priceCents: commerce.priceCents,
    availableStock: commerce.availableStock,
    isOutOfStock,
    result: "loaded",
  })

  const rawDescription = listing.customDescription?.trim() || listing.product.description
  const plainDescription = stripDescriptionImageMarkers(rawDescription).replace(/\s+/g, " ").trim()

  return {
    listingId: listing.id,
    title: listingDisplayTitle(listing.customTitle, listing.product.name),
    descriptionExcerpt: plainDescription.slice(0, 420),
    imageUrl: listingPrimaryImageUrl(listing.customImages, listing.product.images) || "/placeholder.png",
    priceLabel: formatStoreCurrencyFromCents(commerce.priceCents),
    priceCents: commerce.priceCents,
    isOutOfStock,
    stockLabel,
    marketplaceHref: `/marketplace/${listing.id}`,
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
      const commerce = resolveResellerDefaultListingCommerce({
        listingSellingPriceCents: listing.sellingPriceCents,
        variantPricingRaw: listing.variantPricing,
        promotedVariantKeys: listing.promotedVariantKeys,
        product: {
          basePriceCents: listing.product.basePriceCents,
          stock: listing.product.stock,
          variants: listing.product.variants,
          colors: listing.product.colors ?? [],
          customColumns: listing.product.customColumns,
          productVariants: listing.product.productVariants ?? [],
        },
      })

      return {
        id: listing.id,
        productId: listing.productId,
        title: listingDisplayTitle(listing.customTitle, listing.product.name),
        priceCents: commerce.priceCents,
        priceLabel: formatStoreCurrencyFromCents(commerce.priceCents),
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
