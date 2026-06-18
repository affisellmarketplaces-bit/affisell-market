import type { ProductVariantLine } from "@/lib/product-variants"

const SUPPLIER_ADD_PRODUCT_CACHE_KEY_PREFIX = "affisell:supplier-add-product-draft:v2"

export function supplierAddProductDraftCacheKey(ownerUserId: string): string {
  const id = ownerUserId.trim()
  if (!id) return `${SUPPLIER_ADD_PRODUCT_CACHE_KEY_PREFIX}:anonymous`
  return `${SUPPLIER_ADD_PRODUCT_CACHE_KEY_PREFIX}:${id}`
}

/** @deprecated Use scoped key via ownerUserId — kept for one-time cleanup. */
export const SUPPLIER_ADD_PRODUCT_CACHE_KEY = "affisell:supplier-add-product-draft:v1"

export type SupplierAddProductCacheMode = "assist" | "compose" | "plain"

export type SupplierVariantFormMode = "none" | "simple" | "advanced"

export type SupplierColorImageFormRow = { color: string; image: string }

/** Simple mode: one row per color + optional hero image URL (PDP `colorImages`). */
export type SupplierSimpleColorRow = { id: string; name: string; image: string }

export type SupplierAddProductCachePayload = {
  v: 1 | 2
  /** Supplier user id — must match session or cache is ignored. */
  ownerUserId?: string
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
  isLuxury?: boolean
  offerMode?: string
  minOrderQuantity?: number
  supplierTag: string
  specValues: Record<string, string>
  /** “About this item” lines (same order as PDP bullets). */
  descriptionBullets: string[]
  /** Optional images under long description. */
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

export function readSupplierAddProductDraftCache(
  mode: SupplierAddProductCacheMode,
  ownerUserId: string
): SupplierAddProductCachePayload | null {
  if (typeof window === "undefined") return null
  const owner = ownerUserId.trim()
  if (!owner) return null
  try {
    localStorage.removeItem(SUPPLIER_ADD_PRODUCT_CACHE_KEY)
    const raw = localStorage.getItem(supplierAddProductDraftCacheKey(owner))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SupplierAddProductCachePayload
    if (parsed?.v !== 1 && parsed?.v !== 2) return null
    if (parsed.ownerUserId && parsed.ownerUserId !== owner) return null
    if (parsed.mode !== mode) return null
    if (typeof parsed.specValues !== "object" || !parsed.specValues) return null
    const descriptionBullets = Array.isArray(parsed.descriptionBullets)
      ? (parsed.descriptionBullets.filter((x): x is string => typeof x === "string"))
      : []
    const descriptionIllustrationImages = Array.isArray(parsed.descriptionIllustrationImages)
      ? parsed.descriptionIllustrationImages.filter((x): x is string => typeof x === "string")
      : []
    const descriptionIllustrationVideos = Array.isArray(parsed.descriptionIllustrationVideos)
      ? parsed.descriptionIllustrationVideos.filter((x): x is string => typeof x === "string")
      : []
    return { ...parsed, descriptionBullets, descriptionIllustrationImages, descriptionIllustrationVideos }
  } catch {
    return null
  }
}

export function writeSupplierAddProductDraftCache(
  ownerUserId: string,
  payload: Omit<SupplierAddProductCachePayload, "v" | "updatedAt" | "ownerUserId">
) {
  if (typeof window === "undefined") return
  const owner = ownerUserId.trim()
  if (!owner) return
  try {
    const full: SupplierAddProductCachePayload = {
      ...payload,
      v: 2,
      ownerUserId: owner,
      updatedAt: Date.now(),
    }
    localStorage.setItem(supplierAddProductDraftCacheKey(owner), JSON.stringify(full))
  } catch {
    /* quota / privacy mode */
  }
}

export function clearSupplierAddProductDraftCache(ownerUserId?: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(SUPPLIER_ADD_PRODUCT_CACHE_KEY)
    if (ownerUserId?.trim()) {
      localStorage.removeItem(supplierAddProductDraftCacheKey(ownerUserId))
    }
  } catch {
    /* ignore */
  }
}
