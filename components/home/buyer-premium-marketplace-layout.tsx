"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { DepartmentBar } from "@/components/DepartmentBar"
import { EuropeBanner } from "@/components/EuropeBanner"
import { PopularDepartmentsBar } from "@/components/PopularDepartmentsBar"
import { ProductConditionFilterBar } from "@/components/ProductConditionFilterBar"
import { MarketplaceShipsToChip } from "@/components/marketplace/marketplace-ships-to-chip"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import type { PremiumCategoryItem } from "@/lib/marketplace-premium-home-shared"
import type { ResolvedBrowseDepartment } from "@/lib/taxonomy/browse-departments-shared"

type Props = {
  shell: HomeMarketplaceShell
  browseDepartments: ResolvedBrowseDepartment[]
  discoverSlot: React.ReactNode
  catalogExplorer: React.ReactNode
}

function PremiumMarketplaceBody({
  shell,
  browseDepartments,
  discoverSlot,
  catalogExplorer,
}: Props) {
  const searchParams = useSearchParams()
  const activeCategoryId = searchParams.get("category")

  const categories: PremiumCategoryItem[] = shell.categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    count: c.count,
    fullPath: c.fullPath,
  }))

  return (
    <div className="min-w-0 space-y-5 p-3 sm:p-5">
      {/* Primary category rail — e36f03f64 pill styling, frosted-glass shell */}
      <DepartmentBar
        categories={categories}
        catalogTotal={shell.catalogTotal}
        activeCategoryId={activeCategoryId}
      />

      {/* Discover 2×2 — immediately under categories (mockup structure) */}
      <div className="min-w-0">{discoverSlot}</div>

      <PopularDepartmentsBar
        activeCategoryId={activeCategoryId}
        initialDepartments={browseDepartments}
      />

      <div className="min-w-0 space-y-4">
        <EuropeBanner />
        <div className="flex flex-wrap items-center gap-2">
          <MarketplaceShipsToChip
            basePath="/"
            className="!bg-[#EDE9FE] !text-violet-900 !ring-violet-200"
          />
        </div>
        <ProductConditionFilterBar initialCounts={shell.offerRailCounts} />
        {/* Single #explorer anchor — sticky PublicNav; avoid void under hash scroll. */}
        <div id="explorer" className="min-h-[16rem] min-w-0 scroll-mt-28">
          {catalogExplorer}
        </div>
      </div>
    </div>
  )
}

export function BuyerPremiumMarketplaceLayoutClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[24rem] animate-pulse rounded-2xl bg-white/80 p-6" aria-hidden />
      }
    >
      <PremiumMarketplaceBody {...props} />
    </Suspense>
  )
}
