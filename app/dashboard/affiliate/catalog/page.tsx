import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AffiliateHero } from "@/components/marketplace/AffiliateHero"
import { HomeHighlights } from "@/components/home/HomeHighlights"
import { auth } from "@/auth"
import { loadHomeHighlights } from "@/lib/home-marketplace-data"
import { loadHomeMarketplaceStatsSafe } from "@/lib/public-home-data"

import { AffiliateCatalogView } from "./affiliate-catalog-view"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Catalogue affilié — Affisell",
  robots: { index: false, follow: false },
}

async function loadHighlightsSafe() {
  try {
    return await loadHomeHighlights()
  } catch (err) {
    console.error("[affiliate/catalog] loadHomeHighlights failed:", err)
    return { bestSellers7d: [], newArrivals: [], highMargin: [] }
  }
}

export default async function AffiliateCatalogPage() {
  const session = await auth()
  const role = session?.user?.role
  if (role === "SUPPLIER") {
    redirect("/dashboard/supplier")
  }
  if (role !== "AFFILIATE") {
    redirect("/login/affiliate")
  }

  const [stats, highlights] = await Promise.all([
    loadHomeMarketplaceStatsSafe(),
    loadHighlightsSafe(),
  ])

  return (
    <main className="min-h-[calc(100dvh-3.75rem)]">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8">
        <AffiliateHero stats={stats} />
        <HomeHighlights data={highlights} mode="affiliate" />
      </div>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-12 text-center text-zinc-600 dark:text-zinc-400 md:px-8">
            Chargement du catalogue…
          </div>
        }
      >
        <AffiliateCatalogView />
      </Suspense>
    </main>
  )
}
