"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { CategorySidebar } from "@/components/CategorySidebar"
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
    <div className="space-y-3 p-3 sm:p-4">
      <DepartmentBar
        categories={categories}
        catalogTotal={shell.catalogTotal}
        activeCategoryId={activeCategoryId}
      />
      <PopularDepartmentsBar
        activeCategoryId={activeCategoryId}
        initialDepartments={browseDepartments}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <CategorySidebar
          categories={categories}
          catalogTotal={shell.catalogTotal}
          activeCategoryId={activeCategoryId}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <EuropeBanner />
          <div className="flex flex-wrap items-center gap-2">
            <MarketplaceShipsToChip basePath="/" className="!bg-[#EDE9FE] !text-violet-900 !ring-violet-200" />
          </div>
          <ProductConditionFilterBar initialCounts={shell.offerRailCounts} />
          {discoverSlot}
          <div id="explorer" className="min-w-0 scroll-mt-24">
            {catalogExplorer}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BuyerPremiumMarketplaceLayoutClient(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-[24rem] animate-pulse rounded-2xl bg-white/80 p-6" aria-hidden />}>
      <PremiumMarketplaceBody {...props} />
    </Suspense>
  )
}
