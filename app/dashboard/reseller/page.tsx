import Link from "next/link"

import { ResellerRequestCtaBanner } from "@/components/reseller/GlobalRequestButton"
import { requireAffiliateSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

/**
 * Soft reseller home — CTA + shortcuts into affiliate surfaces.
 * Primary dashboard remains /dashboard/affiliate.
 */
export default async function ResellerHomePage() {
  await requireAffiliateSession("/dashboard/reseller")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Espace reseller</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Demandes produits, catalogue et Radar — tout au même endroit.
          </p>
        </div>
        <ResellerRequestCtaBanner />
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/dashboard/reseller/requests"
              className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:border-orange-300"
            >
              Mes demandes →
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/affiliate/catalog"
              className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:border-orange-300"
            >
              Catalogue →
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/affiliate"
              className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:border-orange-300"
            >
              Dashboard →
            </Link>
          </li>
          <li>
            <Link
              href="/radar"
              className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:border-orange-300"
            >
              Radar →
            </Link>
          </li>
        </ul>
      </div>
    </main>
  )
}
