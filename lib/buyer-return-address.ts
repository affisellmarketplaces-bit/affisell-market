import {
  formatSupplierLogisticsAddress,
  parseSupplierLogisticsAddress,
  type SupplierLogisticsAddress,
} from "@/lib/supplier-logistics-address"

/** Strip merchant-identifying company name — RGPD / anti-scraping. */
export function formatBuyerSafeReturnAddress(raw: unknown): string | null {
  const parsed = parseSupplierLogisticsAddress(raw)
  if (!parsed) return null
  const anonymized: SupplierLogisticsAddress = {
    ...parsed,
    company: undefined,
  }
  return formatSupplierLogisticsAddress(anonymized)
}
