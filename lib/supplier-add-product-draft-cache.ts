import type { ProductVariantLine } from "@/lib/product-variants"

export const SUPPLIER_ADD_PRODUCT_CACHE_KEY = "affisell:supplier-add-product-draft:v1"

export type SupplierAddProductCacheMode = "assist" | "compose" | "plain"

export type SupplierVariantFormMode = "none" | "simple" | "advanced"

export type SupplierColorImageFormRow = { color: string; image: string }

/** Simple mode: one row per color + optional hero image URL (PDP `colorImages`). */
export type SupplierSimpleColorRow = { id: string; name: string; image: string }

export type SupplierAddProductCachePayload = {
  v: 1
  mode: SupplierAddProductCacheMode
  step: 1 | 2 | 3
  updatedAt: number
  name: string
  description: string
  categoryId: string
  images: string[]
  price: string
  compareAt: string
  stock: string
  listingKind: string
  commission: string
  shippingCountry: string
  warehouseType: "" | "local" | "regional" | "international"
  processingTime: string
  deliveryMin: string
  deliveryMax: string
  shippingCost: string
  shipsFrom: string
  deliveryDays: string
  freeShipping: boolean
  supplierTag: string
  specValues: Record<string, string>
  /** “About this item” lines (same order as PDP bullets). */
  descriptionBullets: string[]
  /** Optional images under long description (max 4). */
  descriptionIllustrationImages?: string[]
  /** Optional video URLs (max 2). */
  descriptionIllustrationVideos?: string[]
  variantFormMode?: SupplierVariantFormMode
  variantSizesText?: string
  variantColorsText?: string
  variantRows?: ProductVariantLine[]
  variantColorImageRows?: SupplierColorImageFormRow[]
  simpleColorRows?: SupplierSimpleColorRow[]
}

export function readSupplierAddProductDraftCache(mode: SupplierAddProductCacheMode): SupplierAddProductCachePayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SUPPLIER_ADD_PRODUCT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SupplierAddProductCachePayload
    if (parsed?.v !== 1 || parsed.mode !== mode) return null
    if (typeof parsed.specValues !== "object" || !parsed.specValues) return null
    const descriptionBullets = Array.isArray(parsed.descriptionBullets)
      ? (parsed.descriptionBullets.filter((x): x is string => typeof x === "string"))
      : []
    const descriptionIllustrationImages = Array.isArray(parsed.descriptionIllustrationImages)
      ? parsed.descriptionIllustrationImages.filter((x): x is string => typeof x === "string").slice(0, 4)
      : []
    const descriptionIllustrationVideos = Array.isArray(parsed.descriptionIllustrationVideos)
      ? parsed.descriptionIllustrationVideos.filter((x): x is string => typeof x === "string").slice(0, 2)
      : []
    return { ...parsed, descriptionBullets, descriptionIllustrationImages, descriptionIllustrationVideos }
  } catch {
    return null
  }
}

export function writeSupplierAddProductDraftCache(payload: Omit<SupplierAddProductCachePayload, "v" | "updatedAt">) {
  if (typeof window === "undefined") return
  try {
    const full: SupplierAddProductCachePayload = {
      ...payload,
      v: 1,
      updatedAt: Date.now(),
    }
    localStorage.setItem(SUPPLIER_ADD_PRODUCT_CACHE_KEY, JSON.stringify(full))
  } catch {
    /* quota / privacy mode */
  }
}

export function clearSupplierAddProductDraftCache() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(SUPPLIER_ADD_PRODUCT_CACHE_KEY)
  } catch {
    /* ignore */
  }
}
