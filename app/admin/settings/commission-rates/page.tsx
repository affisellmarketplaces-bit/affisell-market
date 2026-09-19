import Link from "next/link"
import { redirect } from "next/navigation"

import { CategoryCommissionRatesClient } from "@/app/admin/settings/commission-rates/commission-rates-client"
import { loadCategoryCommissionRates } from "@/lib/admin/commission-rates/load-category-commission-rates"
import { DEFAULT_AFFISELL_COMMISSION_BPS } from "@/lib/affisell-platform-commission"
import { DEFAULT_SUPPLIER_COMMISSION_BPS } from "@/lib/supplier-commission-rate"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
  q?: string
  leaf?: string
}>

export default async function AdminCommissionRatesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/settings/commission-rates")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const sp = await searchParams
  const search = sp.q?.trim() ?? ""
  const leafOnly = sp.leaf === "1" || sp.leaf === "true"

  const rows = await loadCategoryCommissionRates({
    search: search || undefined,
    leafOnly,
    limit: 250,
  })

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Admin</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Grilles commission par catégorie
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-violet-700 dark:text-violet-400">Affisell</span> — commission
            côté fournisseur, prélevée sur le prix de gros HT selon la catégorie (défaut{" "}
            {DEFAULT_AFFISELL_COMMISSION_BPS / 100}% si aucun taux n’est défini). Côté revendeur : 20 % fixe
            sur son net HT (commission + marge), non modifiable ici.{" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Fournisseur → affilié</span>{" "}
            — commission catalogue quand le produit est à 0 % (défaut{" "}
            {DEFAULT_SUPPLIER_COMMISSION_BPS / 100}%). Les overrides produit posés par l’admin restent
            prioritaires au checkout.
          </p>
        </div>
        <Link
          href="/admin/splits"
          className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline dark:text-violet-400 md:min-h-0"
        >
          Voir les splits →
        </Link>
      </div>

      <CategoryCommissionRatesClient
        initialRows={rows}
        initialSearch={search}
        initialLeafOnly={leafOnly}
      />
    </main>
  )
}
