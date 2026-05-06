"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { AffiliateCommissionCard } from "@/components/affiliate-commission-card"
import { useUserRole } from "@/hooks/useUserRole"

export default function DashboardProductDetailPage() {
  const params = useParams<{ id: string }>()
  const role = useUserRole()
  const isBuyer = role === "buyer"
  const listingId = params?.id ?? ""

  if (isBuyer) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Dashboard Product</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Seller tools are only available for seller/admin accounts.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Product Seller View</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Listing ID: {listingId}
      </p>

      <section className="affiliate-section mt-6 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          AFFILIATE EARNINGS BY OPTION
        </p>
        {/* Placeholder rows until this route is wired to the same product variant data source */}
        <AffiliateCommissionCard
          variant={{
            id: "default",
            name: "Default option",
            sku: "DEFAULT",
            priceCents: 0,
            stock: 0,
            commission: 25,
            sales: 0,
          }}
          basePriceEur={0}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`/affiliate/products/new?listing=${listingId}`}
          className="block rounded-xl border border-zinc-300 py-3 text-center font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Promote
        </Link>
        <Link
          href={`/dashboard/supplier/products/new?edit=${listingId}`}
          className="block rounded-xl bg-zinc-900 py-3 text-center font-medium text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Edit
        </Link>
      </div>
    </main>
  )
}
