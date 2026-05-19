import type { Metadata } from "next"
import { Suspense } from "react"

import { CustomerMarketplaceView } from "./customer-marketplace-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Marketplace — Affisell",
  description: "Parcourez les annonces des boutiques partenaires Affisell.",
  robots: { index: true, follow: true },
}

export default function CustomerMarketplaceBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-zinc-600 dark:text-zinc-400 md:px-8">
          Chargement…
        </div>
      }
    >
      <CustomerMarketplaceView />
    </Suspense>
  )
}
