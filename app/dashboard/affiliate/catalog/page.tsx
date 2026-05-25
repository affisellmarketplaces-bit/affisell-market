import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AffiliateCatalogExperience } from "@/components/affiliate/affiliate-catalog-experience"
import { auth } from "@/auth"
import { loadAffiliateCatalogHighlights } from "@/lib/affiliate-catalog-query"
import type { AffiliateCatalogHighlights } from "@/lib/affiliate-catalog-types"
import { loadHomeMarketplaceStatsSafe } from "@/lib/public-home-data"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Catalogue affilié — Affisell",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toUrlSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value) && value[0]) params.set(key, value[0])
  }
  return params
}

export default async function AffiliateCatalogPage({ searchParams }: PageProps) {
  const session = await auth()
  const role = session?.user?.role
  if (role === "SUPPLIER") {
    redirect("/dashboard/supplier")
  }
  if (role !== "AFFILIATE" || !session?.user?.id) {
    redirect("/login/affiliate")
  }

  const sp = toUrlSearchParams(await searchParams)

  const emptyHighlights: AffiliateCatalogHighlights = {
    bestSellers7d: [],
    newArrivals: [],
    highMargin: [],
  }

  const [stats, highlights] = await Promise.all([
    loadHomeMarketplaceStatsSafe().catch((err) => {
      console.error("[affiliate/catalog] stats failed:", err)
      return {
        productCount: 0,
        avgCommissionPct: 0,
        productCountLabel: "0",
        avgCommissionLabel: "0 %",
      }
    }),
    loadAffiliateCatalogHighlights(session.user.id, sp).catch((err) => {
      console.error("[affiliate/catalog] highlights failed:", err)
      return emptyHighlights
    }),
  ])

  return (
    <main className="min-h-[calc(100dvh-3.75rem)]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-600 md:px-8">
            Chargement du catalogue…
          </div>
        }
      >
        <AffiliateCatalogExperience stats={stats} initialHighlights={highlights} />
      </Suspense>
    </main>
  )
}
