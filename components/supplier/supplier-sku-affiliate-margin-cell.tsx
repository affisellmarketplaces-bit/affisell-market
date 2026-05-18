"use client"

import {
  affiliateMarginEur,
  affiliateMarginTone,
  affiliateMarginToneClass,
} from "@/lib/supplier-sku-affiliate-earning"
import { formatStoreCurrency } from "@/lib/market-config"
import type { SupplierSkuTableRow } from "@/lib/supplier-sku-builder"
import { cn } from "@/lib/utils"

type Props = {
  row: SupplierSkuTableRow
  className?: string
}

export function SupplierSkuAffiliateMarginCell({ row, className }: Props) {
  const amount = affiliateMarginEur({
    supplierPrice: row.supplierPrice,
    commissionRate: row.commissionRate,
    compareAtEur: row.compareAtEur,
  })
  const tone = affiliateMarginTone(amount)
  return (
    <span
      className={cn(
        "text-sm font-semibold tabular-nums",
        affiliateMarginToneClass(tone),
        className
      )}
      title="Estimation : prix public illustratif × commission %"
    >
      {formatStoreCurrency(amount)}
    </span>
  )
}
