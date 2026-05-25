/** Supplier affiliate preview product shape — safe for `"use client"` (no Prisma). */

export type SupplierAffiliatePreviewProduct = {
  id: string
  name: string
  description: string
  basePriceCents: number
  compareAt: number | null
  commissionRate: number
  listingKind: string
  stock: number
  active: boolean
  isDraft: boolean
  images: string[]
  categories: string[]
  tags: string[]
  deliveryMin: number
  deliveryMax: number
  handlingDays: number
  shippingCountry: string | null
  shippingType: string
  variants: unknown
  colorImages: unknown
}
