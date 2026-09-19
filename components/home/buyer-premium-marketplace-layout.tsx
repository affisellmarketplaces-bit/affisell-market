"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { DepartmentBar } from "@/components/DepartmentBar"
import { PopularDepartmentsBar } from "@/components/PopularDepartmentsBar"
import { HomeQuickStrip } from "@/components/home/discovery/home-quick-strip"
import { GlassCatalogShell, type GlassProduct, type GlassTrend } from "@/components/home/glass/glass-catalog-shell"
import { ProductConditionFilterBar } from "@/components/ProductConditionFilterBar"
import { normalizeHomeCatalogProduct } from "@/lib/home-catalog-product-href"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import type { PremiumCategoryItem } from "@/lib/marketplace-premium-home-shared"
import type { ResolvedBrowseDepartment } from "@/lib/taxonomy/browse-departments-shared"

type Props = {
  shell: HomeMarketplaceShell
  browseDepartments: ResolvedBrowseDepartment[]
  discoverSlot: React.ReactNode
  catalogExplorer: React.ReactNode
  /** Confirmed best sellers of the week (server-loaded, may be empty). */
  trending?: GlassTrend[]
  /** Streamed server slot: flash sales, collections, shops, department directory (may render nothing). */
  discoverySlot?: React.ReactNode
}

function PremiumMarketplaceBody({
  shell,
  browseDepartments,
  discoverSlot,
  catalogExplorer,
  trending = [],
  discoverySlot,
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

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  const glassProducts: GlassProduct[] = shell.products
    .flatMap((raw) => {
      const n = normalizeHomeCatalogProduct(raw)
      if (!n || !n.title.trim()) return []
      const o = raw as Record<string, unknown>
      return [
        {
          id: n.id,
          productId: typeof o.productId === "string" ? o.productId : n.id,
          title: n.title,
          image: n.image,
          fallbackImage: n.fallbackImage,
          href: n.href,
          price: num(o.price),
          rating: num(o.averageRating),
          reviews: num(o.reviewCount),
        },
      ]
    })
    .slice(0, 9)

  return (
    <div className="min-w-0 space-y-5 p-3 sm:p-5">
      <HomeQuickStrip />

      {/* Desktop: Categories · Featured products · Filters & Trending (mobile keeps the rails below). */}
      <GlassCatalogShell
        categories={categories}
        products={glassProducts}
        catalogTotal={shell.catalogTotal}
        trending={trending}
      />

      {/* Primary category rail — e36f03f64 pill styling, frosted-glass shell */}
      <DepartmentBar
        categories={categories}
        catalogTotal={shell.catalogTotal}
        activeCategoryId={activeCategoryId}
        className="lg:hidden"
      />

      {/* Discover 2×2 — immediately under categories (mockup structure) */}
      <div className="min-w-0">{discoverSlot}</div>

      {discoverySlot}

      <PopularDepartmentsBar
        activeCategoryId={activeCategoryId}
        initialDepartments={browseDepartments}
        className="lg:hidden"
      />

      <div className="min-w-0 space-y-4">
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
