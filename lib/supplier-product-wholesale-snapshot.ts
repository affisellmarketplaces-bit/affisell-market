import { buildWholesaleSnapshot, type WholesaleSnapshot } from "@/lib/affiliate-wholesale-change-guard"
import { prisma } from "@/lib/prisma"

export const supplierProductWholesaleSelect = {
  id: true,
  active: true,
  isDraft: true,
  basePriceCents: true,
  variants: true,
  colors: true,
  hasVariants: true,
  productVariants: {
    select: {
      color: true,
      size: true,
      stock: true,
      supplierPrice: true,
      wholesalePriceCents: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const

export type SupplierProductWholesaleRow = {
  id: string
  active: boolean
  isDraft: boolean
  basePriceCents: number
  variants: unknown
  colors: string[]
  hasVariants: boolean
  productVariants: Array<{
    color: string | null
    size: string | null
    stock: number
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}

export function isSupplierProductLiveForWholesaleGuard(product: {
  active: boolean
  isDraft: boolean
}): boolean {
  return product.active && !product.isDraft
}

export function wholesaleSnapshotFromSupplierProductRow(
  product: Omit<SupplierProductWholesaleRow, "id" | "active" | "isDraft">
): WholesaleSnapshot {
  return buildWholesaleSnapshot({
    basePriceCents: product.basePriceCents,
    variants: product.variants,
    colors: product.colors,
    hasVariants: product.hasVariants,
    productVariants: product.productVariants,
  })
}

export async function loadSupplierProductWholesaleRow(
  productId: string
): Promise<SupplierProductWholesaleRow | null> {
  return prisma.product.findUnique({
    where: { id: productId },
    select: supplierProductWholesaleSelect,
  })
}
