import { Suspense } from "react"

import { MarketplaceView } from "./marketplace-view"

export const dynamic = "force-dynamic"

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#FCFCFC]">
          <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-500">Loading…</div>
        </main>
      }
    >
      <MarketplaceView />
    </Suspense>
  )
}
