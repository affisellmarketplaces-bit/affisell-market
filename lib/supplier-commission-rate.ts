import { defaultAffiliateCommissionPct } from "@/lib/supplier-commission"

/** Default supplier → affiliate commission when no product / category / supplier override (15%). */
export const DEFAULT_SUPPLIER_COMMISSION_BPS = defaultAffiliateCommissionPct() * 100

const MAX_SUPPLIER_COMMISSION_BPS = 10_000

export function clampSupplierCommissionRateBps(bps: number): number {
  if (!Number.isFinite(bps)) return DEFAULT_SUPPLIER_COMMISSION_BPS
  return Math.min(MAX_SUPPLIER_COMMISSION_BPS, Math.max(0, Math.round(bps)))
}

export function supplierCommissionPercentToBps(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_SUPPLIER_COMMISSION_BPS
  return clampSupplierCommissionRateBps(Math.round(percent * 100))
}

export type ProductSupplierCommissionSource = {
  supplierCommissionRateBps: number | null
  /** Legacy Int % (11 = 11%). */
  commissionRate: number
}

/**
 * Resolve supplier → affiliate commission bps from product fields (no DB).
 * Precedence: `supplierCommissionRateBps` → SKU % → `commissionRate` → fallback.
 */
export function resolveSupplierCommissionRateBpsFromProduct(args: {
  product: ProductSupplierCommissionSource
  skuCommissionPercent?: number | null
  categoryBps?: number | null
  supplierDefaultBps?: number | null
}): number {
  if (args.product.supplierCommissionRateBps != null) {
    return clampSupplierCommissionRateBps(args.product.supplierCommissionRateBps)
  }
  if (args.skuCommissionPercent != null && Number.isFinite(args.skuCommissionPercent)) {
    return supplierCommissionPercentToBps(args.skuCommissionPercent)
  }
  if (args.product.commissionRate > 0) {
    return supplierCommissionPercentToBps(args.product.commissionRate)
  }
  if (args.categoryBps != null) {
    return clampSupplierCommissionRateBps(args.categoryBps)
  }
  if (args.supplierDefaultBps != null) {
    return clampSupplierCommissionRateBps(args.supplierDefaultBps)
  }
  return DEFAULT_SUPPLIER_COMMISSION_BPS
}
