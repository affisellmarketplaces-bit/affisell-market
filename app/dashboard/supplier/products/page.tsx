import Link from "next/link"
import { requireSupplierSession } from "@/lib/dashboard-session"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierDashboardProductsCatalog } from "@/components/supplier/supplier-dashboard-products-catalog"
import { SupplierWholesaleImpactPanel } from "@/components/supplier/supplier-wholesale-impact-panel"
import { findSupplierProductsForDashboardCatalog } from "@/lib/supplier-product-is-draft-fallback"
import {
  emptySupplierWholesaleImpact,
  loadSupplierWholesaleImpact,
} from "@/lib/load-supplier-wholesale-impact"
import { supplierWholesaleImpactByProductId } from "@/lib/supplier-wholesale-impact"
import { loadOrFallback } from "@/lib/safe-server-data"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ drafts?: string }>
}) {
  const session = await requireSupplierSession("/dashboard/supplier/products")


  const { drafts: draftsQs } = await searchParams
  const draftsOnly = draftsQs === "1"

  const [products, store, partnerListingGroups, wholesaleImpact] = await Promise.all([
    findSupplierProductsForDashboardCatalog(session.user.id),
    prisma.store.findUnique({
      where: { userId: session.user.id },
      select: { slug: true, name: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { product: { supplierId: session.user.id }, isListed: true },
      _count: { _all: true },
    }),
    loadOrFallback(
      "supplier/products/wholesale-impact",
      () => loadSupplierWholesaleImpact(session.user.id),
      emptySupplierWholesaleImpact()
    ),
  ])

  const partnerListingCountByProductId = Object.fromEntries(
    partnerListingGroups.map((row) => [row.productId, row._count._all])
  )

  const storefrontHref = store
    ? `/store/supplier/${encodeURIComponent(store.slug)}`
    : `/store/supplier/${encodeURIComponent(session.user.id)}`

  /** Vitrine catalogue : brouillons uniquement dans l’onglet dédié — jamais mélangés aux SKU publiés. */
  const catalogProducts = draftsOnly
    ? products.filter((p) => p.isDraft)
    : products.filter((p) => !p.isDraft)

  const productNameById = Object.fromEntries(catalogProducts.map((p) => [p.id, p.name]))
  const wholesaleImpactByProductId = supplierWholesaleImpactByProductId(wholesaleImpact)

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="7xl">
        <nav
          className="mb-6 flex flex-wrap items-center gap-2 text-sm"
          aria-label="Navigation catalogue"
        >
          <Link
            href="/dashboard/supplier"
            className="rounded-full px-3 py-1.5 font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            ← Mission control
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            /
          </span>
          <span
            className={cn(
              "rounded-full bg-white px-3 py-1.5 font-semibold text-zinc-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-zinc-900 dark:text-zinc-50 dark:ring-white/10",
              draftsOnly && "bg-amber-50 text-amber-950 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100"
            )}
          >
            {draftsOnly ? "Brouillons" : "Produits"}
          </span>
          {!draftsOnly && draftCount(products) > 0 ? (
            <Link
              href="/dashboard/supplier/products?drafts=1"
              className="rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {draftCount(products)} brouillon{draftCount(products) === 1 ? "" : "s"}
            </Link>
          ) : null}
        </nav>

        {!draftsOnly ? (
          <SupplierWholesaleImpactPanel
            data={wholesaleImpact}
            productNameById={productNameById}
          />
        ) : null}

        <SupplierDashboardProductsCatalog
          ownerUserId={session.user.id}
          products={catalogProducts}
          draftsOnly={draftsOnly}
          storefrontHref={storefrontHref}
          storefrontName={store?.name ?? null}
          partnerListingCountByProductId={partnerListingCountByProductId}
          wholesaleImpactByProductId={wholesaleImpactByProductId}
        />
      </BentoContainer>
    </BentoShell>
  )
}

function draftCount(products: { isDraft: boolean }[]) {
  return products.filter((p) => p.isDraft).length
}
