import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
  resolveAffiliatePlatformFeeBps,
  resolveSupplierFeeBps,
} from "@/lib/marketplace-phase1-fees"
import type { SupplierFeeUserOverrides } from "@/lib/marketplace-supplier-fee"

/** Human-readable percent from basis points (1200 → "12 %"). */
export function formatFeeBpsPercent(bps: number): string {
  const clamped = Math.max(0, Math.round(bps))
  const pct = clamped / 100
  const decimals = pct % 1 === 0 ? 0 : 1
  return `${pct.toFixed(decimals)} %`
}

export type SupplierFeeRatesDisplay = {
  catalogBps: number
  autoBuyBps: number
  affiliateEarningsBps: number
  catalogPercent: string
  autoBuyPercent: string
  affiliatePercent: string
  usesLegacyOverride: boolean
}

export function supplierFeeRatesDisplay(
  supplier?: SupplierFeeUserOverrides | null,
  affiliatePlatformFeeBps?: number | null
): SupplierFeeRatesDisplay {
  const legacy = supplier?.supplierFeeBps ?? null
  const catalogBps = resolveSupplierFeeBps(
    legacy ?? supplier?.supplierFeeBpsCatalog ?? DEFAULT_SUPPLIER_FEE_BPS_CATALOG
  )
  const autoBuyBps = resolveSupplierFeeBps(
    legacy ?? supplier?.supplierFeeBpsAutoBuy ?? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY
  )
  const affiliateEarningsBps = resolveAffiliatePlatformFeeBps(affiliatePlatformFeeBps)

  return {
    catalogBps,
    autoBuyBps,
    affiliateEarningsBps,
    catalogPercent: formatFeeBpsPercent(catalogBps),
    autoBuyPercent: formatFeeBpsPercent(autoBuyBps),
    affiliatePercent: formatFeeBpsPercent(affiliateEarningsBps),
    usesLegacyOverride: legacy != null,
  }
}
