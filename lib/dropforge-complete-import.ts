import { Prisma } from "@prisma/client"

import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import type { ProductVariantInput } from "@/lib/product-variant-sku"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"
import { VARIANT_COLOR_REGEX } from "@/lib/supplier-sku-builder"
import {
  extractVideoUrls,
  guessIso2Country,
  mapImportedVariants,
  parseDeliveryRange,
} from "@/lib/url-import-apply"

export const DROPFORGE_MAX_IMAGES = 24
export const DROPFORGE_MAX_DESC = 8000

export type DropForgeVariantRow = {
  name: string
  type: string
  image: string
  price: number
  stock: number
  sku: string
  attributes: Record<string, string>
}

export type DropForgeColorRow = { name: string; image: string; hex: string }

export type DropForgeShipping = {
  from_country: string
  delivery_time: string
  shipping_cost: number
  carrier: string
}

/** Full DropForge fiche — every field we persist on commit. */
export type DropForgeCompletePreview = {
  title: string
  description: string
  images: string[]
  videos: string[]
  variants: DropForgeVariantRow[]
  colors: DropForgeColorRow[]
  sizes: string[]
  specs: Record<string, string>
  shipping: DropForgeShipping
  tags: string[]
  seoKeywords: string[]
  sku: string
  originalPrice: number
  reviewCount: number
  reviewRating: number
  costPrice: number
  suggestedPrice: number
  profitPerSale: number
  currency: string
  brand: string
  category: string
  stock: number
  platform: string
  marketplaceLabel: string
  method: string
  sourceUrl: string
  warnings: string[]
  partial?: boolean
  catalogProductId?: string
  /** Auto-buy path ready (AliExpress id or catalog SupplierLink). */
  fulfillmentReady?: boolean
  fulfillmentReason?: "aliexpress" | "catalog_link" | "pending_ops"
  aliexpressProductId?: string | null
}

/** DropForge never accepts an empty shell — title + image + price required. */
export function isDropForgeImportComplete(
  p: Pick<DropForgeCompletePreview, "title" | "description" | "images" | "costPrice">
): boolean {
  return (
    p.title.trim().length >= 3 &&
    p.description.trim().length >= 3 &&
    p.images.length >= 1 &&
    p.costPrice > 0 &&
    Number.isFinite(p.costPrice)
  )
}

export function dropForgeIncompleteError(marketplaceLabel: string): string {
  return `DropForge n’a pas pu importer la fiche complète (${marketplaceLabel}). Vérifie l’URL produit, ou configure ALIEXPRESS_APP_KEY / SCRAPINGBEE_API_KEY sur le serveur.`
}

export function emptyDropForgeExtras(): Pick<
  DropForgeCompletePreview,
  | "videos"
  | "variants"
  | "colors"
  | "sizes"
  | "specs"
  | "shipping"
  | "tags"
  | "seoKeywords"
  | "sku"
  | "originalPrice"
  | "reviewCount"
  | "reviewRating"
> {
  return {
    videos: [],
    variants: [],
    colors: [],
    sizes: [],
    specs: {},
    shipping: {
      from_country: "",
      delivery_time: "",
      shipping_cost: 0,
      carrier: "",
    },
    tags: [],
    seoKeywords: [],
    sku: "",
    originalPrice: 0,
    reviewCount: 0,
    reviewRating: 0,
  }
}

/** Merge two scraped products — keep primary, fill every empty field from secondary. */
export function mergeScrapedProducts(
  primary: SupplierScrapedProduct,
  secondary: SupplierScrapedProduct
): SupplierScrapedProduct {
  const images = [
    ...primary.images,
    ...secondary.images.filter((u) => !primary.images.includes(u)),
  ].slice(0, DROPFORGE_MAX_IMAGES)
  const videos = [
    ...primary.videos,
    ...secondary.videos.filter((u) => !primary.videos.includes(u)),
  ].slice(0, 6)
  const variants =
    primary.variants.length > 0 ? primary.variants : secondary.variants
  const colors = primary.colors.length > 0 ? primary.colors : secondary.colors
  const sizes = primary.sizes.length > 0 ? primary.sizes : secondary.sizes
  const specs =
    Object.keys(primary.specs).length > 0 ? primary.specs : secondary.specs
  const price = primary.price > 0 ? primary.price : secondary.price
  const suggested =
    primary.suggested_price > 0
      ? primary.suggested_price
      : secondary.suggested_price
  return {
    ...primary,
    title: primary.title.trim() || secondary.title,
    description: primary.description.trim() || secondary.description,
    ai_title: primary.ai_title.trim() || secondary.ai_title,
    ai_description: primary.ai_description.trim() || secondary.ai_description,
    price,
    original_price:
      primary.original_price > 0
        ? primary.original_price
        : secondary.original_price,
    currency: primary.currency || secondary.currency,
    images,
    videos,
    variants,
    colors,
    sizes,
    brand: primary.brand.trim() || secondary.brand,
    category: primary.category.trim() || secondary.category,
    sku: primary.sku.trim() || secondary.sku,
    stock: primary.stock > 0 ? primary.stock : secondary.stock,
    shipping: {
      from_country:
        primary.shipping.from_country || secondary.shipping.from_country,
      delivery_time:
        primary.shipping.delivery_time || secondary.shipping.delivery_time,
      shipping_cost:
        primary.shipping.shipping_cost > 0
          ? primary.shipping.shipping_cost
          : secondary.shipping.shipping_cost,
      carrier: primary.shipping.carrier || secondary.shipping.carrier,
    },
    reviews:
      primary.reviews.total > 0 ? primary.reviews : secondary.reviews,
    specs,
    basePrice: suggested || primary.basePrice || secondary.basePrice,
    costPrice: price || primary.costPrice || secondary.costPrice,
    suggested_price: suggested || price,
    tags: [...new Set([...primary.tags, ...secondary.tags])],
    seo_keywords: [
      ...new Set([...primary.seo_keywords, ...secondary.seo_keywords]),
    ],
    quality_score: Math.max(primary.quality_score, secondary.quality_score),
  }
}

export function scrapedToVariantInputs(
  product: Pick<
    DropForgeCompletePreview,
    "variants" | "colors" | "sizes" | "costPrice" | "suggestedPrice" | "stock"
  >
): ProductVariantInput[] {
  const cost = Math.max(0.01, product.costPrice)
  const mapped = mapImportedVariants(
    {
      variants: product.variants,
      colors: product.colors,
      sizes: product.sizes.map((s) => ({ name: s, value: s })),
    },
    product.suggestedPrice || cost * 2.8,
    "15"
  )

  const out: ProductVariantInput[] = []

  if (mapped.mode === "advanced") {
    for (const row of mapped.variantRows) {
      const colorRaw = row.name.split(/[|/·•]/)[0]?.trim() || row.name
      const color = colorRaw.slice(0, 32)
      if (!VARIANT_COLOR_REGEX.test(color)) continue
      out.push({
        color,
        size: null,
        sku: row.sku || null,
        supplierPrice: Math.max(
          0.01,
          (row.priceCents || Math.round(cost * 100)) / 100
        ),
        publicPrice: Math.max(
          0.01,
          (row.priceCents || Math.round(cost * 100)) / 100
        ),
        stock: Math.max(0, row.stock),
        commissionRate: 15,
        weightGrams: null,
        ean: null,
        originCountry: "CN",
        warehouseCode: null,
        videoUrl: null,
        processingDays: 2,
      })
    }
  }

  if (out.length === 0 && mapped.mode === "simple") {
    const colors =
      mapped.simpleColors.map((c) => c.name).filter(Boolean).length > 0
        ? mapped.simpleColors.map((c) => c.name).filter(Boolean)
        : ["Default"]
    const sizes = mapped.sizes.length > 0 ? mapped.sizes : [null]
    for (const colorName of colors) {
      const color = colorName.slice(0, 32)
      if (!VARIANT_COLOR_REGEX.test(color)) continue
      for (const size of sizes) {
        out.push({
          color,
          size: size ? size.slice(0, 16) : null,
          sku: null,
          supplierPrice: cost,
          publicPrice: cost,
          stock: Math.max(
            0,
            Math.round(
              product.stock / Math.max(1, colors.length * sizes.length)
            )
          ),
          commissionRate: 15,
          weightGrams: null,
          ean: null,
          originCountry: "CN",
          warehouseCode: null,
          videoUrl: null,
          processingDays: 2,
        })
      }
    }
  }

  return out.slice(0, 80)
}

export function buildDropForgeProductPersistFields(preview: DropForgeCompletePreview): {
  name: string
  description: string
  descriptionBullets: string[]
  descriptionIllustrationVideos: string[]
  images: string[]
  colors: string[]
  colorImages: Prisma.InputJsonValue | undefined
  variants: Prisma.InputJsonValue | undefined
  tags: string[]
  basePriceCents: number
  compareAt: Prisma.Decimal | null
  stock: number
  shippingCountry: string | null
  warehouseType: string | null
  deliveryMin: number
  deliveryMax: number
  shippingCost: Prisma.Decimal
  shipsFrom: string | null
  attributes: Array<{ key: string; value: string; label: string }>
  variantInputs: ProductVariantInput[]
} {
  const costCents = Math.max(1, Math.round(preview.costPrice * 100))
  const videos = extractVideoUrls(preview.videos, 4)
  const colorNames = preview.colors
    .map((c) => c.name.trim())
    .filter(Boolean)
    .slice(0, 24)
  const colorImages =
    preview.colors.length > 0
      ? preview.colors
          .filter((c) => c.name.trim())
          .slice(0, 24)
          .map((c) => ({
            color: c.name.trim(),
            hex: resolveColorSwatchMeta(c.name, c.hex).hex,
            image: c.image && /^https?:\/\//i.test(c.image) ? c.image : "",
          }))
      : undefined

  const shipCc = guessIso2Country(preview.shipping.from_country)
  const { min, max } = parseDeliveryRange(preview.shipping.delivery_time)
  const bullets = Object.entries(preview.specs)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${v}`)

  const attributes = Object.entries(preview.specs)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .slice(0, 40)
    .map(([k, v]) => ({
      key: k.slice(0, 64).toLowerCase().replace(/\s+/g, "_"),
      value: v.slice(0, 500),
      label: k.slice(0, 120),
    }))

  if (preview.brand && preview.brand !== "Generic") {
    attributes.unshift({
      key: "brand",
      value: preview.brand,
      label: "Brand",
    })
  }

  const compareAt =
    preview.originalPrice > preview.costPrice
      ? new Prisma.Decimal(preview.originalPrice.toFixed(2))
      : null

  const tags = [
    ...new Set([
      "reseller_url_import",
      "dropforge",
      preview.platform,
      preview.method,
      ...preview.tags,
      ...preview.seoKeywords,
    ]),
  ]
    .filter(Boolean)
    .slice(0, 40)

  return {
    name: preview.title.slice(0, 200),
    description: preview.description.slice(0, DROPFORGE_MAX_DESC),
    descriptionBullets: bullets,
    descriptionIllustrationVideos: videos,
    images: preview.images.slice(0, DROPFORGE_MAX_IMAGES),
    colors: colorNames.length > 0 ? colorNames : preview.sizes.slice(0, 24),
    colorImages: colorImages as Prisma.InputJsonValue | undefined,
    variants:
      preview.variants.length > 0
        ? (preview.variants as unknown as Prisma.InputJsonValue)
        : undefined,
    tags,
    basePriceCents: costCents,
    compareAt,
    stock: preview.stock > 0 ? preview.stock : 99,
    shippingCountry: shipCc || null,
    warehouseType:
      shipCc === "CN" || /china|cn/i.test(preview.shipping.from_country)
        ? "international"
        : shipCc
          ? "regional"
          : null,
    deliveryMin: Math.max(1, parseInt(min, 10) || 2),
    deliveryMax: Math.max(1, parseInt(max, 10) || 5),
    shippingCost: new Prisma.Decimal(
      Math.max(0, preview.shipping.shipping_cost || 0).toFixed(2)
    ),
    shipsFrom: preview.shipping.from_country || null,
    attributes,
    variantInputs: scrapedToVariantInputs(preview),
  }
}
