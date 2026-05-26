import { prisma } from "@/lib/prisma"
import { commissionRateForOption } from "@/lib/product-variants"
import type { ProductVariantsJson } from "@/lib/product-variants"

import {
  clampSupplierCommissionRateBps,
  resolveSupplierCommissionRateBpsFromProduct,
} from "@/lib/supplier-commission-rate"

type CategoryCommissionRow = {
  supplierCommissionRateBps: number | null
  parentId: string | null
}

export async function resolveCategorySupplierCommissionBps(categoryId: string): Promise<number | null> {
  let parentId: string | null = categoryId
  const visited = new Set<string>()

  while (parentId !== null) {
    if (visited.has(parentId)) break
    visited.add(parentId)

    const row: CategoryCommissionRow | null = await prisma.category.findUnique({
      where: { id: parentId },
      select: {
        supplierCommissionRateBps: true,
        parentId: true,
      },
    })
    if (!row) break
    if (row.supplierCommissionRateBps != null) {
      return clampSupplierCommissionRateBps(row.supplierCommissionRateBps)
    }
    parentId = row.parentId
  }

  return null
}

export async function resolveSupplierCommissionRateBpsForProductId(args: {
  productId: string
  optionName?: string | null
  variants?: ProductVariantsJson | null
}): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: {
      supplierCommissionRateBps: true,
      commissionRate: true,
      categoryId: true,
      supplierId: true,
      variants: true,
    },
  })
  if (!product) {
    return resolveSupplierCommissionRateBpsFromProduct({
      product: { supplierCommissionRateBps: null, commissionRate: 0 },
    })
  }

  const variants = args.variants ?? (product.variants as ProductVariantsJson | null)
  const skuCommissionPercent = commissionRateForOption({
    variants,
    optionName: args.optionName,
    productCommissionRate: product.commissionRate,
  })

  const categoryBps = product.categoryId
    ? await resolveCategorySupplierCommissionBps(product.categoryId)
    : null

  const supplier = await prisma.user.findUnique({
    where: { id: product.supplierId },
    select: { defaultSupplierCommissionRateBps: true },
  })

  return resolveSupplierCommissionRateBpsFromProduct({
    product: {
      supplierCommissionRateBps: product.supplierCommissionRateBps,
      commissionRate: product.commissionRate,
    },
    skuCommissionPercent,
    categoryBps,
    supplierDefaultBps: supplier?.defaultSupplierCommissionRateBps ?? null,
  })
}
