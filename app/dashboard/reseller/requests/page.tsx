import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { GlobalRequestButton } from "@/components/reseller/GlobalRequestButton"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { formatProductRequestRelativeTime } from "@/lib/product-request-i18n"
import {
  formatProductRequestCountries,
  resolveProductRequestCountries,
} from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ResellerRequestsPage() {
  const session = await requireAffiliateSession("/dashboard/reseller/requests")
  const [t, tCat, tStatus, tList, locale] = await Promise.all([
    getTranslations("productRequests"),
    getTranslations("productRequests.categories"),
    getTranslations("productRequests.status"),
    getTranslations("productRequests.reseller.list"),
    getLocale(),
  ])

  const rows = await prisma.productRequest.findMany({
    where: { resellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-zinc-900">{tList("title")}</h1>
          <GlobalRequestButton variant="primary" label={tList("newButton")} />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-bold text-zinc-900">{tList("emptyTitle")}</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600">{tList("howItWorks")}</p>
            <ol className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-sm text-zinc-700">
              <li>
                <strong>1.</strong> {tList("step1")}
              </li>
              <li>
                <strong>2.</strong> {tList("step2")}
              </li>
              <li>
                <strong>3.</strong> {tList("step3")}
              </li>
              <li>
                <strong>4.</strong> {tList("step4")}
              </li>
            </ol>
            <div className="mt-6">
              <GlobalRequestButton variant="primary" label={tList("emptyCta")} />
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const countries = resolveProductRequestCountries(r)
              const statusKey = r.status === "open" || r.status === "fulfilled" ? r.status : "closed"
              return (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/reseller/requests/${r.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-violet-300"
                  >
                    <div>
                      <p className="font-semibold text-zinc-900">{r.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatProductRequestCountries(countries)} · {tCat(r.category)} ·{" "}
                        {r.quantity} {t("common.pieces")} ·{" "}
                        {formatProductRequestRelativeTime(r.createdAt, locale)}
                        {r.quotesCount > 0
                          ? ` · ${tList("metaQuotes", { count: r.quotesCount })}`
                          : ""}
                      </p>
                      {r.deliverySLA != null ? (
                        <div className="mt-1.5">
                          <DeliveryBadge days={r.deliverySLA} countries={countries} />
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        statusKey === "open"
                          ? "bg-emerald-50 text-emerald-700"
                          : statusKey === "fulfilled"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {tStatus(statusKey)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
