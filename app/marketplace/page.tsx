import type { Metadata } from "next"
import { Suspense } from "react"

import { MarketplaceView } from "./marketplace-view"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Marketplace Affisell",
  robots: { index: false, follow: false },
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100dvh-3.75rem)] text-zinc-600 dark:text-zinc-400">
          <div className="mx-auto max-w-7xl px-4 py-20 text-center md:px-8">Loading…</div>
        </main>
      }
    >
      <MarketplaceView />
    </Suspense>
  )
}
