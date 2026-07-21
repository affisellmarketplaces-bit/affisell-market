import { Suspense } from "react"
import Link from "next/link"

import { ResellerRequestForm } from "@/components/requests/ResellerRequestForm"
import { requireAffiliateSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

export default async function ResellerRequestNewPage() {
  await requireAffiliateSession("/dashboard/reseller/requests/new")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Demander un produit introuvable</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Les fournisseurs Affisell sont alertés instantanément.
            </p>
          </div>
          <Link
            href="/dashboard/reseller/requests"
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            Mes demandes →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
            <ResellerRequestForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
