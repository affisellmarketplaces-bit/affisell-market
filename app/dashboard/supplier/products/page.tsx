import Link from "next/link"

import { auth } from "@/auth"
import { SupplierDashboardProductsCatalog } from "@/components/supplier/supplier-dashboard-products-catalog"
import { findSupplierProductsForDashboardCatalog } from "@/lib/supplier-product-is-draft-fallback"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierProductsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        <Link href="/login?callbackUrl=/dashboard/supplier/products" className="underline">
          Sign in
        </Link>{" "}
        to manage products.
      </div>
    )
  }
  if (session.user.role !== "SUPPLIER") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        Supplier access only.
      </div>
    )
  }

  const [products, store, partnerListingGroups] = await Promise.all([
    findSupplierProductsForDashboardCatalog({ supplierId: session.user.id }),
    prisma.store.findUnique({
      where: { userId: session.user.id },
      select: { slug: true, name: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { product: { supplierId: session.user.id }, isListed: true },
      _count: { _all: true },
    }),
  ])

  const partnerListingCountByProductId = Object.fromEntries(
    partnerListingGroups.map((row) => [row.productId, row._count._all])
  )

  const storefrontHref = store
    ? `/store/supplier/${encodeURIComponent(store.slug)}`
    : `/store/supplier/${encodeURIComponent(session.user.id)}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100/90 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/95">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
          <Link
            href="/dashboard/supplier/products"
            className="inline-flex rounded-lg bg-white px-3 py-1.5 text-zinc-900 shadow-sm ring-1 ring-black/[0.05] dark:bg-zinc-900 dark:text-zinc-50 dark:ring-white/10"
          >
            Products
          </Link>
          <Link
            href="/dashboard/supplier"
            className="text-teal-700 transition hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
          >
            ← Supplier home
          </Link>
          <Link
            href={storefrontHref}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Open storefront in new tab
          </Link>
        </nav>
        <SupplierDashboardProductsCatalog
          products={products}
          storefrontHref={storefrontHref}
          storefrontName={store?.name ?? null}
          partnerListingCountByProductId={partnerListingCountByProductId}
        />
      </div>
    </div>
  )
}
