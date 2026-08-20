import { Suspense } from "react"

import { HomeCatalogSkeleton } from "@/components/home/home-catalog-skeleton"

import { CustomerMarketplaceBrowseInner } from "@/app/shops/browse/customer-marketplace-browse-inner"

/** Standalone buyer catalog — skeleton streams immediately, DB shell loads after. */
export function CustomerMarketplaceBrowse() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
          <HomeCatalogSkeleton count={12} />
        </div>
      }
    >
      <CustomerMarketplaceBrowseInner />
    </Suspense>
  )
}
