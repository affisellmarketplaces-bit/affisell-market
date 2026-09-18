import Link from "next/link"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import { auth } from "@/lib/auth"
import type { AppLocale } from "@/lib/i18n-locale"
import { getRadarDb } from "@/lib/prisma-radar"
import { getConnectorById } from "@/lib/radar/connectors/registry"
import { resolveRadarDashboardCountry } from "@/lib/radar/dashboard-country.server"
import { RADAR_DEMO_WINNERS } from "@/lib/radar/demo-data"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { loadRadarPlanContext } from "@/lib/radar/plan-user.server"
import { formatRadarPriceDisplay } from "@/lib/radar/format-radar-price"
import { countryCodeToName } from "@/lib/radar/map/geo"
import { loadRadarCountryIntel } from "@/lib/radar/map/load-country-intel.server"
import { canViewResellerMarketPrice } from "@/lib/radar/radar-price-veil"

type Props = {
  searchParams: Promise<{ country?: string; productId?: string }>
}

const NUMBER_LOCALE: Record<AppLocale, string> = {
  fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", zh: "zh-CN",
}

export default async function RadarWinnersPage({ searchParams }: Props) {
  if (!isRadarEnabled()) redirect("/404")
  const t = await getTranslations("radarPages")
  const locale = (await getLocale()) as AppLocale
  const numLocale = NUMBER_LOCALE[locale] ?? "en-US"

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { country: countryParam, productId } = await searchParams
  const countryFilter = countryParam?.trim()
    ? resolveRadarDashboardCountry(countryParam)
    : null

  const { planUser, plan } = await loadRadarPlanContext({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro,
    features: session.user.features,
  })
  const access = checkRadarAccess(planUser, "dashboard")
  if (!access.allowed || plan.id === "free" || plan.id === "starter") {
    return (
      <RadarPaywallPanel
        plan={plan}
        title={t("winnersPaywallTitle")}
        reason={t("winnersPaywallReason")}
      />
    )
  }

  let demoMode = false
  let totalCount: number | null = null
  let winners: Array<{
    id: string
    title: string
    marketplaceId: string
    country: string
    price: { toString(): string } | number
    currency: string | null
    rank: number | null
    salesEst: number | null
    url: string | null
  }> = []

  if (countryFilter) {
    const intel = await loadRadarCountryIntel(countryFilter, { take: 100 })
    if (intel) {
      demoMode = intel.demo
      totalCount = intel.count
      winners = intel.products.map((p) => ({
        id: p.id,
        title: p.title,
        marketplaceId: p.marketplaceId,
        country: p.country,
        price: p.price,
        currency: p.currency,
        rank: p.rank,
        salesEst: p.salesEst,
        url: p.url,
      }))
    }
  } else if (!resolveRadarDatabaseUrl()) {
    demoMode = true
  } else {
    try {
      winners = await getRadarDb().radarGlobalSnapshot.findMany({
        where: { rank: { lte: 20 } },
        orderBy: [{ rank: "asc" }, { crawledAt: "desc" }],
        take: 50,
      })
    } catch (err) {
      demoMode = true
      console.warn("[radar/winners]", {
        result: "demo_mode",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  if (!countryFilter && (demoMode || winners.length === 0)) {
    if (demoMode) winners = RADAR_DEMO_WINNERS
  }

  const highlightId = productId?.trim() || null
  const title = countryFilter
    ? t("winnersTitleCountry", { country: countryCodeToName(countryFilter, locale), code: countryFilter })
    : t("winnersTitleGlobal")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {countryFilter ? (
              <>
                {t("winnersSnapshots24")}
                {totalCount != null ? (
                  <>
                    {" "}
                    —{" "}
                    <span className="font-semibold text-zinc-800">
                      {t("winnersProductsSameAsMap", { n: totalCount.toLocaleString(numLocale) })}
                    </span>
                  </>
                ) : null}
                {demoMode ? ` ${t("winnersDemoSuffix")}` : ""}
              </>
            ) : (
              <>{t("winnersGlobalSnapshots")}{demoMode ? ` ${t("winnersDemoSuffix")}` : ""}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {countryFilter ? (
            <Link
              href="/radar/winners"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
            >
              {t("winnersAllCountries")}
            </Link>
          ) : null}
          <Link
            href="/radar/map"
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {t("winnersBackToMap")}
          </Link>
        </div>
      </div>

      {demoMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("winnersDemoBanner")}
        </div>
      )}

      {countryFilter && totalCount != null && winners.length < totalCount ? (
        <p className="text-xs text-zinc-500">
          {t("winnersShowingTop", {
            shown: winners.length.toLocaleString(numLocale),
            total: totalCount.toLocaleString(numLocale),
          })}
        </p>
      ) : null}

      {winners.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          {t("winnersEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t("winnersColTitle")}</th>
                <th className="px-3 py-2">{t("winnersColMarketplace")}</th>
                <th className="px-3 py-2">
                  {canViewResellerMarketPrice(session.user.role) ? t("winnersColPrice") : t("winnersColSignal")}
                </th>
                <th className="px-3 py-2">{t("winnersColCountry")}</th>
                <th className="px-3 py-2">{t("winnersColSales")}</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((row, idx) => {
                const connector = getConnectorById(row.marketplaceId)
                const highlighted = highlightId != null && row.id === highlightId
                return (
                  <tr
                    key={row.id}
                    id={highlighted ? `winner-${row.id}` : undefined}
                    className={
                      highlighted
                        ? "border-b border-violet-200 bg-violet-50"
                        : "border-b border-zinc-100"
                    }
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.rank ?? idx + 1}
                    </td>
                    <td className="max-w-sm px-3 py-2">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 font-medium text-zinc-900 hover:text-violet-700"
                        >
                          {row.title}
                        </a>
                      ) : (
                        <span className="line-clamp-2 font-medium">{row.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {connector?.logo} {connector?.name ?? row.marketplaceId}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {canViewResellerMarketPrice(session.user.role)
                        ? formatRadarPriceDisplay(row.price, row.currency)
                        : t("winnersDemandChip")}
                    </td>
                    <td className="px-3 py-2">{row.country}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.salesEst != null ? row.salesEst.toLocaleString(numLocale) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
