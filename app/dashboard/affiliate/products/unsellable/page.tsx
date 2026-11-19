import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadUnsellableListings } from "@/lib/reseller-replacement/replace.server"
import { UNSELLABLE_LIST_PATH } from "@/lib/reseller-replacement/unsellable-alerts"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

/**
 * Every product of the reseller's shop that buyers can not buy today, each with its cause and the way out (withdraw or
 * replace). The page the daily summary notice links to — read-only, nothing changes until the reseller confirms.
 */
export default async function AffiliateUnsellableListingsPage() {
  const session = await requireAffiliateSession(UNSELLABLE_LIST_PATH)
  const t = await getTranslations("affiliate.replacement")
  const rows = await loadOrFallback("affiliate-unsellable-list", () => loadUnsellableListings(session.user.id), [])
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("listTitle")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("listSubtitle", { count: rows.length })}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {t("listEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.listingId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.productName}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{t(`problem.${r.problem}`)}</p>
              </div>
              <Link
                href={`/dashboard/affiliate/products/${encodeURIComponent(r.listingId)}/replace`}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t("listCta")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">{t("historyKept")}</p>
    </main>
  )
}
