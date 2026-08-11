import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { isDraftSchemaOrDbError } from "@/lib/supplier-product-is-draft-fallback"
import {
  captureWholesaleSnapshotFromProductRow,
} from "@/lib/affiliate-wholesale-change-notify"

const PUT_LOAD_SELECT_WITH_ISDRAFT = {
  listingKind: true,
  commissionRate: true,
  stock: true,
  isDraft: true,
  basePriceCents: true,
  variants: true,
  colors: true,
  hasVariants: true,
  deliveryCountryCodes: true,
  customColumns: true,
  categoryId: true,
  offerMode: true,
  isRefurbished: true,
  minOrderQuantity: true,
  images: true,
  warehouseType: true,
  shippingCountry: true,
  warehouseCity: true,
  processingTime: true,
  deliveryMin: true,
  deliveryMax: true,
  shippingMethods: true,
  freeShippingThreshold: true,
  shippingCost: true,
  digitalAccessUrl: true,
  digitalAccessInstructions: true,
  digitalInstantDelivery: true,
  bookingDurationMinutes: true,
  bookingCancellationHours: true,
  bookingVenueLabel: true,
  bookingInstantConfirm: true,
  productVariants: {
    select: {
      id: true,
      color: true,
      size: true,
      stock: true,
      supplierPrice: true,
      publicPrice: true,
      wholesalePriceCents: true,
      sku: true,
      weightGrams: true,
      processingDays: true,
      ean: true,
      originCountry: true,
      warehouseCode: true,
      videoUrl: true,
      customData: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  attributes: {
    select: { key: true, label: true, value: true },
    orderBy: { key: "asc" as const },
  },
} as const satisfies Prisma.ProductSelect

const PUT_LOAD_SELECT_NO_ISDRAFT = {
  listingKind: true,
  commissionRate: true,
  stock: true,
  basePriceCents: true,
  variants: true,
  colors: true,
  hasVariants: true,
  deliveryCountryCodes: true,
  customColumns: true,
  categoryId: true,
  offerMode: true,
  isRefurbished: true,
  minOrderQuantity: true,
  images: true,
  warehouseType: true,
  shippingCountry: true,
  warehouseCity: true,
  processingTime: true,
  deliveryMin: true,
  deliveryMax: true,
  shippingMethods: true,
  freeShippingThreshold: true,
  shippingCost: true,
  digitalAccessUrl: true,
  digitalAccessInstructions: true,
  digitalInstantDelivery: true,
  bookingDurationMinutes: true,
  bookingCancellationHours: true,
  bookingVenueLabel: true,
  bookingInstantConfirm: true,
  productVariants: PUT_LOAD_SELECT_WITH_ISDRAFT.productVariants,
  attributes: PUT_LOAD_SELECT_WITH_ISDRAFT.attributes,
} as const satisfies Prisma.ProductSelect

export type SupplierProductPutGuard = {
  listingKind: string
  commissionRate: number
  stock: number
  isDraft: boolean
  basePriceCents: number
}

export type SupplierProductPutOfferRow = {
  offerMode: string
  isRefurbished: boolean
  minOrderQuantity: number
  images: string[]
  warehouseType: string | null
  shippingCountry: string | null
  warehouseCity: string | null
  processingTime: number | null
  deliveryMin: number | null
  deliveryMax: number | null
  shippingMethods: unknown
  freeShippingThreshold: Prisma.Decimal | null
  shippingCost: Prisma.Decimal
  digitalAccessUrl: string | null
  digitalAccessInstructions: string | null
  digitalInstantDelivery: boolean
  bookingDurationMinutes: number | null
  bookingCancellationHours: number | null
  bookingVenueLabel: string | null
  bookingInstantConfirm: boolean
}

export type SupplierProductPutLoad = {
  guard: SupplierProductPutGuard
  wholesaleBeforeSnapshot: ReturnType<typeof captureWholesaleSnapshotFromProductRow> | null
  offerRow: SupplierProductPutOfferRow
  deliveryCountryCodes: string[]
  customColumns: unknown
  attributes: Array<{ key: string; label: string; value: string }>
  listingVariantsJson: unknown
  productVariants: Prisma.ProductGetPayload<{
    select: typeof PUT_LOAD_SELECT_WITH_ISDRAFT
  }>["productVariants"]
}

function mapPutLoadRow(
  row: Prisma.ProductGetPayload<{ select: typeof PUT_LOAD_SELECT_WITH_ISDRAFT }>
): SupplierProductPutLoad {
  const wholesaleBeforeSnapshot = captureWholesaleSnapshotFromProductRow(row)
  const offerRow: SupplierProductPutOfferRow = {
    offerMode: row.offerMode,
    isRefurbished: row.isRefurbished,
    minOrderQuantity: row.minOrderQuantity,
    images: row.images,
    warehouseType: row.warehouseType,
    shippingCountry: row.shippingCountry,
    warehouseCity: row.warehouseCity,
    processingTime: row.processingTime,
    deliveryMin: row.deliveryMin,
    deliveryMax: row.deliveryMax,
    shippingMethods: row.shippingMethods,
    freeShippingThreshold: row.freeShippingThreshold,
    shippingCost: row.shippingCost,
    digitalAccessUrl: row.digitalAccessUrl,
    digitalAccessInstructions: row.digitalAccessInstructions,
    digitalInstantDelivery: row.digitalInstantDelivery,
    bookingDurationMinutes: row.bookingDurationMinutes,
    bookingCancellationHours: row.bookingCancellationHours,
    bookingVenueLabel: row.bookingVenueLabel,
    bookingInstantConfirm: row.bookingInstantConfirm,
  }

  return {
    guard: {
      listingKind: row.listingKind,
      commissionRate: row.commissionRate,
      stock: row.stock,
      isDraft: row.isDraft,
      basePriceCents: row.basePriceCents,
    },
    wholesaleBeforeSnapshot,
    offerRow,
    deliveryCountryCodes: row.deliveryCountryCodes,
    customColumns: row.customColumns,
    attributes: row.attributes,
    listingVariantsJson: row.variants,
    productVariants: row.productVariants,
  }
}

/** Single round-trip load for supplier PUT — ownership, guard, wholesale snapshot, offer defaults. */
export async function loadSupplierProductForPut(
  productId: string,
  supplierId: string
): Promise<SupplierProductPutLoad | null> {
  try {
    const row = await prisma.product.findFirst({
      where: { id: productId, supplierId },
      select: PUT_LOAD_SELECT_WITH_ISDRAFT,
    })
    return row ? mapPutLoadRow(row) : null
  } catch (e: unknown) {
    if (!isDraftSchemaOrDbError(e)) throw e
    const row = await prisma.product.findFirst({
      where: { id: productId, supplierId },
      select: PUT_LOAD_SELECT_NO_ISDRAFT,
    })
    if (!row) return null
    return mapPutLoadRow({ ...row, isDraft: false })
  }
}
