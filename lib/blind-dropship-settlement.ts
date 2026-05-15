import {
  computeMarketplaceOrderSettlement,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"

export type BlindLineSettlementInput = {
  linePaidCents: number
  wholesaleUnitCents: number
  qty: number
  supplierCommissionRatePercent: number
}

export type BlindOrderSettlementTotals = MarketplaceOrderSettlement & {
  lineCount: number
}

export function computeBlindLineSettlement(line: BlindLineSettlementInput): MarketplaceOrderSettlement {
  return computeMarketplaceOrderSettlement({
    sellingPriceCents: line.linePaidCents,
    basePriceCents: line.wholesaleUnitCents * line.qty,
    supplierCommissionRatePercent: line.supplierCommissionRatePercent,
  })
}

export function aggregateBlindOrderSettlement(
  lines: MarketplaceOrderSettlement[]
): BlindOrderSettlementTotals {
  const totals = lines.reduce(
    (acc, s) => ({
      sellingPriceCents: acc.sellingPriceCents + s.sellingPriceCents,
      basePriceCents: acc.basePriceCents + s.basePriceCents,
      marginCents: acc.marginCents + s.marginCents,
      affisellFeeCents: acc.affisellFeeCents + s.affisellFeeCents,
      affiliateCommissionCents: acc.affiliateCommissionCents + s.affiliateCommissionCents,
      affiliateMarginRetainedCents: acc.affiliateMarginRetainedCents + s.affiliateMarginRetainedCents,
      supplierNetCents: acc.supplierNetCents + s.supplierNetCents,
    }),
    {
      sellingPriceCents: 0,
      basePriceCents: 0,
      marginCents: 0,
      affisellFeeCents: 0,
      affiliateCommissionCents: 0,
      affiliateMarginRetainedCents: 0,
      supplierNetCents: 0,
    }
  )
  return { ...totals, lineCount: lines.length }
}

export function aggregateBlindLinesForSupplier(
  lines: Array<{ blindDropshipSupplierId: string; settlement: MarketplaceOrderSettlement }>,
  blindDropshipSupplierId: string
): MarketplaceOrderSettlement {
  const slice = lines.filter((l) => l.blindDropshipSupplierId === blindDropshipSupplierId)
  return aggregateBlindOrderSettlement(slice.map((l) => l.settlement))
}
