import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { serializeProductDecimalFields } from "@/lib/serialize-for-client"

/** Every scalar Product field except isDraft — used when the DB lacks the column or client is stale. */
const PRODUCT_SCALAR_SELECT_NO_ISDRAFT = {
  id: true,
  supplierId: true,
  name: true,
  description: true,
  descriptionBullets: true,
  descriptionIllustrationImages: true,
  descriptionIllustrationVideos: true,
  createdAt: true,
  updatedAt: true,
  images: true,
  colorImages: true,
  categories: true,
  colors: true,
  tags: true,
  variants: true,
  basePriceCents: true,
  compareAt: true,
  commissionRate: true,
  listingKind: true,
  stock: true,
  active: true,
  categoryId: true,
  subcategoryId: true,
  style: true,
  shippingType: true,
  handlingDays: true,
  isOnSale: true,
  isNewArrival: true,
  isBestSeller: true,
  isRefurbished: true,
  hasCoupon: true,
  isEcoFriendly: true,
  shippingCountry: true,
  warehouseType: true,
  warehouseCity: true,
  processingTime: true,
  deliveryMin: true,
  deliveryMax: true,
  shippingMethods: true,
  freeShippingThreshold: true,
  shippingCost: true,
  shipsFrom: true,
  deliveryDays: true,
  freeShipping: true,
  supplierTag: true,
  reviewCount: true,
  averageRating: true,
  reviewSentiment: true,
} as const satisfies Prisma.ProductSelect

const PRODUCT_SCALAR_SELECT_WITH_ISDRAFT = {
  ...PRODUCT_SCALAR_SELECT_NO_ISDRAFT,
  isDraft: true,
} as const satisfies Prisma.ProductSelect

/** Supplier dashboard catalog: storefront grid + management (images & compare-at for buyer-style cards). */
const SUPPLIER_DASHBOARD_CATALOG_SELECT_NO_ISDRAFT = {
  id: true,
  name: true,
  basePriceCents: true,
  commissionRate: true,
  listingKind: true,
  stock: true,
  active: true,
  updatedAt: true,
  images: true,
  compareAt: true,
} as const satisfies Prisma.ProductSelect

const SUPPLIER_DASHBOARD_CATALOG_SELECT_WITH_ISDRAFT = {
  ...SUPPLIER_DASHBOARD_CATALOG_SELECT_NO_ISDRAFT,
  isDraft: true,
} as const satisfies Prisma.ProductSelect

const PUT_GUARD_SELECT_WITH_ISDRAFT = {
  listingKind: true,
  commissionRate: true,
  stock: true,
  isDraft: true,
  basePriceCents: true,
} as const satisfies Prisma.ProductSelect

const PUT_GUARD_SELECT_NO_ISDRAFT = {
  listingKind: true,
  commissionRate: true,
  stock: true,
  basePriceCents: true,
} as const satisfies Prisma.ProductSelect

/** Client validation (unknown field/arg) or DB missing column (P2022). */
export function isDraftSchemaOrDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message
  const unknownSelect = /Unknown field\s+[`']isDraft[`']?\s+for\s+select\s+statement/i.test(msg)
  const unknownArg = /Unknown\s+argument\s+[`']?isDraft[`']?/i.test(msg)
  const columnMissing =
    /isDraft/i.test(msg) &&
    (/does\s+not\s+exist/i.test(msg) ||
      (/column\s+.*isDraft/i.test(msg) && /not\s+exist/i.test(msg)))
  const p2022 =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    /isDraft/i.test(msg)

  return Boolean(unknownSelect || unknownArg || columnMissing || p2022)
}

export type SupplierDashboardCatalogProduct = Omit<
  Prisma.ProductGetPayload<{ select: typeof SUPPLIER_DASHBOARD_CATALOG_SELECT_WITH_ISDRAFT }>,
  "compareAt"
> & {
  compareAt: number | null
  isDraft: boolean
}

function serializeDashboardCatalogRow(
  row: Prisma.ProductGetPayload<{ select: typeof SUPPLIER_DASHBOARD_CATALOG_SELECT_WITH_ISDRAFT }>
): SupplierDashboardCatalogProduct {
  return serializeProductDecimalFields(row) as SupplierDashboardCatalogProduct
}

export async function findSupplierProductsForDashboardCatalog(where: { supplierId: string }) {
  try {
    const rows = await prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: SUPPLIER_DASHBOARD_CATALOG_SELECT_WITH_ISDRAFT,
    })
    return rows.map(serializeDashboardCatalogRow)
  } catch (e: unknown) {
    if (!isDraftSchemaOrDbError(e)) throw e
    const rows = await prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: SUPPLIER_DASHBOARD_CATALOG_SELECT_NO_ISDRAFT,
    })
    return rows.map((r) =>
      serializeProductDecimalFields({ ...r, isDraft: false }) as SupplierDashboardCatalogProduct
    )
  }
}

export async function findSupplierProductsForOwnerApi(where: { supplierId: string }) {
  try {
    const rows = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: PRODUCT_SCALAR_SELECT_WITH_ISDRAFT,
    })
    return rows.map(serializeProductDecimalFields)
  } catch (e: unknown) {
    if (!isDraftSchemaOrDbError(e)) throw e
    const rows = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: PRODUCT_SCALAR_SELECT_NO_ISDRAFT,
    })
    return rows.map((r) => serializeProductDecimalFields({ ...r, isDraft: false }))
  }
}

export async function findSupplierProductWithAttributesForOwner(id: string, supplierId: string) {
  try {
    const row = await prisma.product.findFirst({
      where: { id, supplierId },
      include: {
        attributes: { orderBy: { key: "asc" } },
      },
    })
    return row === null ? null : serializeProductDecimalFields(row)
  } catch (e: unknown) {
    if (!isDraftSchemaOrDbError(e)) throw e
    const row = await prisma.product.findFirst({
      where: { id, supplierId },
      select: {
        ...PRODUCT_SCALAR_SELECT_NO_ISDRAFT,
        attributes: { orderBy: { key: "asc" } },
      },
    })
    return row === null ? null : serializeProductDecimalFields({ ...row, isDraft: false })
  }
}

export async function findSupplierProductGuardForPut(id: string) {
  try {
    return await prisma.product.findUnique({
      where: { id },
      select: PUT_GUARD_SELECT_WITH_ISDRAFT,
    })
  } catch (e: unknown) {
    if (!isDraftSchemaOrDbError(e)) throw e
    const row = await prisma.product.findUnique({
      where: { id },
      select: PUT_GUARD_SELECT_NO_ISDRAFT,
    })
    return row === null ? null : { ...row, isDraft: false }
  }
}
