import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { CATEGORIES } from "@/lib/product-catalog-constants"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AffiliateProductsNewPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/affiliate/products/new")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">New affiliate listing</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Product specifications (categories, colors, variants, tags) are defined by suppliers when they publish to
        the catalog. Affiliates pick approved products from the&nbsp;
        <strong>Supplier catalog</strong> tab and set their selling margin — shoppers see merged data on the
        marketplace.
      </p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Category taxonomy you will see on listings</p>
        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard/affiliate"
          className="inline-flex items-center rounded-xl bg-black px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          Open Affiliate dashboard →
        </Link>
        <Link
          href="/marketplace"
          className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Browse marketplace
        </Link>
      </div>
    </main>
  )
}
