import { filterListingForPromotedVariants } from "@/lib/affiliate-storefront-variants"
import {
  lookupVariantPricingEntry,
  parseAffiliateVariantPricingJson,
  resolveAffiliateSellingPriceCentsForOption,
  type AffiliateVariantPricingMap,
} from "@/lib/affiliate-variant-pricing"
import type { ResellerListingVariantSummary } from "@/lib/boutique/reseller-listing-variants-shared"
import {
  buildVariantOptionLabel,
  resolveListingAvailableStock,
} from "@/lib/marketplace-purchase-quantity"
import {
  collectStorageOptionValues,
  findVariantRowForShopperSelection,
  resolveMarketplacePrimaryOptionNames,
  variantsWithProductVariantRows,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import { parseCustomColumnsFromDb } from "@/lib/product-custom-columns"
import { mergeColorImagesForProduct } from "@/lib/product-color-images"
import { variantsFromDb, type ProductVariantsJson } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"

export type ResellerListingProductShape = {
  basePriceCents: number
  stock: number
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

export type ResellerListingVariantContext = {
  variants: ProductVariantsJson | null
  colorNames: string[]
  storageOptions: string[]
  sizeOptions: string[]
  customColumns: CustomColumn[]
  variantPricing: AffiliateVariantPricingMap
}

export type ResellerListingCommerce = {
  priceCents: number
  availableStock: number
  defaultOptionName: string | null
  selectedColor: string | null
  selectedSize: string | null
  selectedStorage: string | null
}

export function prepareResellerListingVariantContext(args: {
  variantPricingRaw: unknown
  promotedVariantKeys: string[] | null | undefined
  product: ResellerListingProductShape
}): ResellerListingVariantContext {
  const customColumns = parseCustomColumnsFromDb(args.product.customColumns)
  const variantsRaw = variantsWithProductVariantRows(
    variantsFromDb(args.product.variants),
    args.product.productVariants ?? [],
    customColumns,
    args.product.basePriceCents
  )
  const storageOptionsRaw = collectStorageOptionValues({
    variants: variantsRaw,
    customColumns,
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
    customColumns,
    productVariantCustomData: args.product.productVariants?.map((v) => v.customData),
  })
  const sizeOptions = variants?.size?.length ? variants.size : []

  return {
    variants,
    colorNames,
    storageOptions,
    sizeOptions,
    customColumns,
    variantPricing: parseAffiliateVariantPricingJson(args.variantPricingRaw),
  }
}

export function resolveResellerListingCommerce(args: {
  listingSellingPriceCents: number
  variantPricingRaw: unknown
  promotedVariantKeys: string[] | null | undefined
  product: ResellerListingProductShape
  selection?: Partial<ShopperVariantSelection>
}): ResellerListingCommerce {
  const ctx = prepareResellerListingVariantContext(args)

  const selectedColor =
    args.selection?.selectedPrimary?.trim() || ctx.colorNames[0] || null
  const selectedSize =
    args.selection?.selectedSize?.trim() ||
    (ctx.sizeOptions.length > 0 ? ctx.sizeOptions[0] ?? null : null)
  const selectedStorage =
    args.selection?.selectedStorage?.trim() ||
    (ctx.storageOptions.length > 0 ? ctx.storageOptions[0] ?? null : null)

  const activeVariantRow = findVariantRowForShopperSelection({
    variants: ctx.variants,
    customColumns: ctx.customColumns,
    selection: {
      selectedPrimary: selectedColor,
      selectedStorage,
      selectedSize,
    },
  })

  const labeledOption = buildVariantOptionLabel(selectedColor, selectedSize)
  const defaultOptionName =
    activeVariantRow?.name?.trim() ||
    (labeledOption && lookupVariantPricingEntry(ctx.variantPricing, labeledOption)
      ? labeledOption
      : null) ||
    selectedColor ||
    Object.keys(ctx.variantPricing)[0] ||
    null

  const priceCents = resolveAffiliateSellingPriceCentsForOption({
    listingSellingPriceCents: args.listingSellingPriceCents,
    productBasePriceCents: args.product.basePriceCents,
    variants: ctx.variants,
    optionName: defaultOptionName,
    variantPricing: ctx.variantPricing,
  })

  const availableStock = activeVariantRow
    ? Math.max(0, Math.round(activeVariantRow.stock) || 0)
    : resolveListingAvailableStock({
        productStock: args.product.stock,
        variants: ctx.variants,
        selectedColor,
        selectedSize,
      })

  return {
    priceCents,
    availableStock,
    defaultOptionName,
    selectedColor,
    selectedSize,
    selectedStorage,
  }
}

export function resolveResellerDefaultListingCommerce(args: {
  listingSellingPriceCents: number
  variantPricingRaw: unknown
  promotedVariantKeys: string[] | null | undefined
  product: ResellerListingProductShape
}): Pick<ResellerListingCommerce, "priceCents" | "availableStock" | "defaultOptionName"> {
  const commerce = resolveResellerListingCommerce(args)
  return {
    priceCents: commerce.priceCents,
    availableStock: commerce.availableStock,
    defaultOptionName: commerce.defaultOptionName,
  }
}

export function summarizeResellerListingVariants(args: {
  listingSellingPriceCents: number
  variantPricingRaw: unknown
  promotedVariantKeys: string[] | null | undefined
  product: ResellerListingProductShape
}): ResellerListingVariantSummary {
  const ctx = prepareResellerListingVariantContext(args)
  const prices: number[] = []

  const primaryOptions =
    ctx.colorNames.length > 0
      ? ctx.colorNames
      : ctx.storageOptions.length > 0
        ? ctx.storageOptions
        : [null]

  for (const primary of primaryOptions) {
    const sizeLoop = ctx.sizeOptions.length > 0 ? ctx.sizeOptions : [null]
    for (const size of sizeLoop) {
      for (const storage of ctx.storageOptions.length > 0 ? ctx.storageOptions : [null]) {
        const row = findVariantRowForShopperSelection({
          variants: ctx.variants,
          customColumns: ctx.customColumns,
          selection: {
            selectedPrimary: primary,
            selectedStorage: storage,
            selectedSize: size,
          },
        })
        const stock = row
          ? Math.max(0, Math.round(row.stock) || 0)
          : resolveListingAvailableStock({
              productStock: args.product.stock,
              variants: ctx.variants,
              selectedColor: primary,
              selectedSize: size,
            })
        if (stock <= 0) continue

        const optionName =
          row?.name?.trim() ||
          buildVariantOptionLabel(primary, size) ||
          primary ||
          null
        prices.push(
          resolveAffiliateSellingPriceCentsForOption({
            listingSellingPriceCents: args.listingSellingPriceCents,
            productBasePriceCents: args.product.basePriceCents,
            variants: ctx.variants,
            optionName,
            variantPricing: ctx.variantPricing,
          })
        )
      }
    }
  }

  const fallback = resolveResellerListingCommerce(args).priceCents
  const priceFromCents = prices.length > 0 ? Math.min(...prices) : fallback
  const priceToCents = prices.length > 0 ? Math.max(...prices) : fallback
  const optionCount = Math.max(prices.length, 1)
  const hasMultipleOptions =
    ctx.colorNames.length > 1 ||
    ctx.sizeOptions.length > 1 ||
    ctx.storageOptions.length > 1 ||
    prices.length > 1

  return {
    optionCount,
    colorNames: ctx.colorNames.slice(0, 12),
    sizeCount: ctx.sizeOptions.length,
    storageCount: ctx.storageOptions.length,
    hasMultipleOptions,
    priceFromCents,
    priceToCents,
  }
}

export function resolveResellerListingColorImages(args: {
  product: ResellerListingProductShape
  colorNames: string[]
}) {
  return mergeColorImagesForProduct(
    args.colorNames,
    args.product.colorImages,
    args.product.variants
  )
}
