import type { Metadata } from "next"
import { Suspense } from "react"

import { AffiliateCatalogExperience } from "@/components/affiliate/affiliate-catalog-experience"
import {
  RadarCatalogArbitragePanel,
  type RadarDraftArbitrageRow,
} from "@/components/import/RadarCatalogArbitragePanel"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadAffiliateOpportunityPulsePicks } from "@/lib/affiliate-catalog-opportunity-pulse"
import { loadAffiliateCatalogHighlights } from "@/lib/affiliate-catalog-query"
import type { AffiliateCatalogHighlights } from "@/lib/affiliate-catalog-types"
import { prisma } from "@/lib/prisma"
import { loadHomeMarketplaceStatsSafe } from "@/lib/public-home-data"
import {
  frArbitrageFromCost,
  isRadarImportDescription,
  parseRadarImportCost,
  scanWorldArbitrage,
} from "@/lib/radar/world-arbitrage-scanner"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Catalogue ambassadeur — Affisell",
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

async function loadRadarDraftArbitrageRows(affiliateId: string): Promise<RadarDraftArbitrageRow[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId,
      isListed: false,
      customDescription: { contains: "Radar import" },
    },
    select: {
      id: true,
      customTitle: true,
      customDescription: true,
      customImages: true,
      sellingPriceCents: true,
      product: { select: { name: true, images: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  })

  return listings
    .filter((l) => isRadarImportDescription(l.customDescription))
    .map((l) => {
      const cost = parseRadarImportCost(l.customDescription) ?? 4.2
      const sale = l.sellingPriceCents / 100
      const pricing = frArbitrageFromCost(cost, sale)
      const scan = scanWorldArbitrage({ title: l.customTitle ?? l.product.name, supplierPrice: cost })
      const countryMatch = l.customDescription?.match(/world_radar_([A-Z]{2})/i)
      return {
        id: l.id,
        title: l.customTitle?.trim() || l.product.name,
        imageUrl: l.customImages[0] ?? l.product.images[0] ?? null,
        costPrice: pricing.costPrice,
        salePrice: pricing.salePrice,
        margin: pricing.margin,
        multiplier: pricing.multiplier,
        score: scan.score,
        sourceCountry: countryMatch?.[1]?.toUpperCase() ?? "FR",
      }
    })
}

export default async function AffiliateCatalogPage({ searchParams }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/affiliate/catalog")

  const raw = await searchParams
  const sp = toUrlSearchParams(raw)
  const filterDraft = sp.get("filter") === "draft"

  const emptyHighlights: AffiliateCatalogHighlights = {
    bestSellers7d: [],
    newArrivals: [],
    highMargin: [],
  }

  const [stats, highlights, opportunityPicks, radarDrafts] = await Promise.all([
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
    loadAffiliateOpportunityPulsePicks(session.user.id, 3).catch((err) => {
      console.error("[affiliate/catalog] opportunity pulse failed:", err)
      return []
    }),
    loadRadarDraftArbitrageRows(session.user.id).catch((err) => {
      console.error("[affiliate/catalog] radar drafts failed:", err)
      return [] as RadarDraftArbitrageRow[]
    }),
  ])

  return (
    <main className="min-h-[calc(100dvh-3.75rem)]">
      {filterDraft || radarDrafts.length > 0 ? (
        <div className="pt-6">
          <RadarCatalogArbitragePanel rows={radarDrafts} />
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-600 md:px-8">
            Chargement du catalogue…
          </div>
        }
      >
        <AffiliateCatalogExperience
          stats={stats}
          initialHighlights={highlights}
          initialOpportunityPicks={opportunityPicks}
        />
      </Suspense>
    </main>
  )
}
