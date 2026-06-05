import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export type SupplierEscrowSummary = {
  upstreamReservedCents: number
  marginHeldCents: number
  marginReleasedCents: number
  ordersInEscrow: number
  autoBuyActive: boolean
}

export function formatEscrowMetric(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}
