import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
  resolveSupplierFeeBps,
} from "@/lib/marketplace-phase1-fees"

export type SupplierFeeMode = "catalog" | "auto_buy"

export type SupplierFeeUserOverrides = {
  /** Legacy: overrides both modes when set. */
  supplierFeeBps?: number | null
  supplierFeeBpsCatalog?: number | null
  supplierFeeBpsAutoBuy?: number | null
}

export type SupplierLinkAutoBuyHint = {
  isActive: boolean
  autoBuyEnabled: boolean
} | null

/** True when this line will use Affisell AE auto-buy (active SupplierLink + toggle). */
export function orderUsesAffisellAutoBuy(input: {
  supplierLink: SupplierLinkAutoBuyHint
  productAutoBuyEnabled?: boolean
}): boolean {
  const link = input.supplierLink
  if (!link?.isActive) return false
  return link.autoBuyEnabled || Boolean(input.productAutoBuyEnabled)
}

export function supplierFeeModeFromAutoBuy(usesAutoBuy: boolean): SupplierFeeMode {
  return usesAutoBuy ? "auto_buy" : "catalog"
}

/** Resolve supplier-side Affisell fee (bps) for a paid order line. */
export function resolveSupplierFeeBpsForOrder(input: {
  usesAffisellAutoBuy: boolean
  supplier: SupplierFeeUserOverrides
}): number {
  const { supplier, usesAffisellAutoBuy } = input

  if (supplier.supplierFeeBps != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBps)
  }

  if (usesAffisellAutoBuy && supplier.supplierFeeBpsAutoBuy != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBpsAutoBuy)
  }

  if (!usesAffisellAutoBuy && supplier.supplierFeeBpsCatalog != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBpsCatalog)
  }

  return usesAffisellAutoBuy
    ? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY
    : DEFAULT_SUPPLIER_FEE_BPS_CATALOG
}
