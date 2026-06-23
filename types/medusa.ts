/** Minimal Medusa Store product shape (no @medusajs/* runtime dep in Next app). */
export type MedusaProductDTO = {
  id: string
  handle?: string
  title?: string
  thumbnail?: string | null
  description?: string | null
}

/** Try-on fields exposed on Medusa Store API (flattened by store middleware). */
export type ProductTryOnFields = {
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

export interface ProductTryOn extends MedusaProductDTO, ProductTryOnFields {}

export type MedusaStoreProductResponse = {
  products: ProductTryOn[]
  count?: number
  offset?: number
  limit?: number
}

export type MedusaStoreSingleProductResponse = {
  product: ProductTryOn
}

export type MedusaProductSource = "medusa" | "local"

export type ResolvedMedusaProduct = {
  source: MedusaProductSource
  id: string
  handle: string
  title: string
  thumbnail: string | null
  try_on_enabled: boolean
  tryon_garment_url: string | null
}
