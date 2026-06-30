import { prisma } from "@/lib/prisma"
import { commissionRateForOption } from "@/lib/product-variants"
import type { ProductVariantsJson } from "@/lib/product-variants"
import {
  applySupplierCommissionDynamics,
  isSupplierCommissionDynamicsEnabled,
} from "@/lib/commission-grid-dynamic"
import { loadSupplierTrailingGmvCents } from "@/lib/supplier-trailing-gmv.server"

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

export type SupplierCommissionResolution = {
  bps: number
  source: "product_bps" | "sku_percent" | "product_percent" | "category_grid" | "supplier_default" | "platform_default"
  categoryBps: number | null
  volumeBonusBps: number
  volumeTierLabel: string | null
  trailingGmvCents: number | null
}

function classifySupplierCommissionSource(args: {
  product: {
    supplierCommissionRateBps: number | null
    commissionRate: number
  }
  skuCommissionPercent: number | null | undefined
  categoryBps: number | null
  supplierDefaultBps: number | null
}): SupplierCommissionResolution["source"] {
  if (args.product.supplierCommissionRateBps != null) return "product_bps"
  if (args.skuCommissionPercent != null && Number.isFinite(args.skuCommissionPercent)) {
    return "sku_percent"
  }
  if (args.product.commissionRate > 0) return "product_percent"
  if (args.categoryBps != null) return "category_grid"
  if (args.supplierDefaultBps != null) return "supplier_default"
  return "platform_default"
}

export async function resolveSupplierCommissionRateBpsDetailed(args: {
  productId: string
  optionName?: string | null
  variants?: ProductVariantsJson | null
}): Promise<SupplierCommissionResolution> {
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
    const bps = resolveSupplierCommissionRateBpsFromProduct({
      product: { supplierCommissionRateBps: null, commissionRate: 0 },
    })
    return {
      bps,
      source: "platform_default",
      categoryBps: null,
      volumeBonusBps: 0,
      volumeTierLabel: null,
      trailingGmvCents: null,
    }
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

  const source = classifySupplierCommissionSource({
    product,
    skuCommissionPercent,
    categoryBps,
    supplierDefaultBps: supplier?.defaultSupplierCommissionRateBps ?? null,
  })

  const baseBps = resolveSupplierCommissionRateBpsFromProduct({
    product: {
      supplierCommissionRateBps: product.supplierCommissionRateBps,
      commissionRate: product.commissionRate,
    },
    skuCommissionPercent,
    categoryBps,
    supplierDefaultBps: supplier?.defaultSupplierCommissionRateBps ?? null,
  })

  if (source !== "category_grid" || !isSupplierCommissionDynamicsEnabled()) {
    return {
      bps: baseBps,
      source,
      categoryBps,
      volumeBonusBps: 0,
      volumeTierLabel: null,
      trailingGmvCents: null,
    }
  }

  const trailingGmvCents = await loadSupplierTrailingGmvCents(product.supplierId)
  const dynamics = applySupplierCommissionDynamics({
    baseBps,
    trailingGmvCents,
  })

  console.log("[supplier-commission]", {
    productId: args.productId,
    source,
    baseBps: dynamics.baseBps,
    volumeBonusBps: dynamics.volumeBonusBps,
    effectiveBps: dynamics.effectiveBps,
    trailingGmvCents: dynamics.trailingGmvCents,
  })

  return {
    bps: dynamics.effectiveBps,
    source,
    categoryBps,
    volumeBonusBps: dynamics.volumeBonusBps,
    volumeTierLabel: dynamics.volumeTierLabel,
    trailingGmvCents: dynamics.trailingGmvCents,
  }
}

export async function resolveSupplierCommissionRateBpsForProductId(args: {
  productId: string
  optionName?: string | null
  variants?: ProductVariantsJson | null
}): Promise<number> {
  const resolution = await resolveSupplierCommissionRateBpsDetailed(args)
  return resolution.bps
}
