export const SUPPLIER_ADD_PRODUCT_CACHE_KEY = "affisell:supplier-add-product-draft:v1"

export type SupplierAddProductCacheMode = "assist" | "compose" | "plain"

export type SupplierAddProductCachePayload = {
  v: 1
  mode: SupplierAddProductCacheMode
  step: 1 | 2
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
    return { ...parsed, descriptionBullets }
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
