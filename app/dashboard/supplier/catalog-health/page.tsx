import { BlockedDemandSection } from "@/components/supplier/blocked-demand-section"
import { CatalogHealthPanel } from "@/components/supplier/catalog-health-panel"
import { StockoutForecastSection } from "@/components/supplier/stockout-forecast-section"
import { VariantStockSection } from "@/components/supplier/variant-stock-section"
import { NextActionsCard } from "@/components/next-best-action/next-actions-card"
import { requireSupplierSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

/** Supplier catalogue health — every diagnosis is computed by the API from the supplier's own data. */
export default async function SupplierCatalogHealthPage() {
  await requireSupplierSession("/dashboard/supplier/catalog-health")
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <NextActionsCard role="supplier" />
      <BlockedDemandSection />
      <StockoutForecastSection />
      <VariantStockSection />
      <CatalogHealthPanel />
    </main>
  )
}
