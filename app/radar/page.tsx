import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import type { Prisma } from ".prisma/client-mi"

import RadarDashboardFilters from "@/components/radar/radar-dashboard-filters"
import RadarForceScanButton from "@/components/radar/radar-force-scan-button"
import { RadarKindCockpit } from "@/components/radar/radar-kind-cockpit"
import RadarMarketingLanding from "@/components/radar/radar-marketing-landing"
import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import RadarTikTokSalesSection from "@/components/radar/radar-tiktok-sales-section"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getRadarDb } from "@/lib/prisma-radar"
import { getTikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"
import type { TikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"
import { getConnectorById } from "@/lib/radar/connectors/registry"
import { RADAR_DEMO_WINNERS } from "@/lib/radar/demo-data"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getTrendingKeywords } from "@/lib/radar/google/trends-watcher"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { parseSupplierKind, type SupplierKind } from "@/lib/supplier-kind"

const TREND_SEEDS = ["led strip", "shapewear", "phone case"]

type WinnerRow = {
  id: string
  title: string
  marketplaceId: string
  country: string
  price: { toString(): string } | number
  currency: string | null
  rank: number | null
  salesEst: number | null
  imageUrl: string | null
  url: string | null
  crawledAt: Date
}

function formatPrice(price: { toString(): string } | number, currency: string | null): string {
  const n = typeof price === "number" ? price : Number(price.toString())
  if (!Number.isFinite(n)) return "—"
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency && currency.length === 3 ? currency : "USD",
    }).format(n)
  } catch {
    return `${n} ${currency ?? ""}`.trim()
  }
}

function formatScanDate(d: Date | null | undefined): string {
  if (!d) return "jamais"
  return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
}

function WinnersTable({
  rows,
  brandHighlight,
}: {
  rows: WinnerRow[]
  /** Producer cockpit: highlight titles matching brand name (non-destructive). */
  brandHighlight?: string | null
}) {
  const brand = brandHighlight?.trim().toLowerCase() ?? ""
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-2 py-2">Rank</th>
            <th className="px-2 py-2">Image</th>
            <th className="px-2 py-2">Title</th>
            <th className="px-2 py-2">Marketplace</th>
            <th className="px-2 py-2">Price</th>
            <th className="px-2 py-2">Country</th>
            <th className="px-2 py-2">Sales est.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const connector = getConnectorById(row.marketplaceId)
            const isBrand =
              brand.length >= 2 && row.title.toLowerCase().includes(brand)
            return (
              <tr
                key={row.id}
                className={
                  isBrand
                    ? "border-b border-violet-100 bg-violet-500/10 align-middle"
                    : "border-b border-zinc-100 align-middle"
                }
              >
                <td className="px-2 py-2 font-mono text-xs text-zinc-700">{row.rank ?? "—"}</td>
                <td className="px-2 py-2">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.imageUrl}
                      alt=""
                      className="size-10 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-lg" aria-hidden>
                      {connector?.logo ?? "📦"}
                    </span>
                  )}
                </td>
                <td className="max-w-xs px-2 py-2">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 font-medium text-zinc-900 hover:text-violet-700"
                    >
                      {row.title}
                      {isBrand ? (
                        <span className="ml-2 inline-flex rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Marque
                        </span>
                      ) : null}
                    </a>
                  ) : (
                    <span className="line-clamp-2 font-medium text-zinc-900">
                      {row.title}
                      {isBrand ? (
                        <span className="ml-2 inline-flex rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Marque
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-zinc-600">{connector?.name ?? row.marketplaceId}</td>
                <td className="px-2 py-2 tabular-nums text-zinc-800">
                  {formatPrice(row.price, row.currency)}
                </td>
                <td className="px-2 py-2 text-zinc-600">{row.country}</td>
                <td className="px-2 py-2 tabular-nums text-zinc-600">
                  {row.salesEst != null ? row.salesEst.toLocaleString("fr-FR") : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function RadarDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string
    marketplace?: string
    country?: string
    q?: string
  }>
}) {
  if (!isRadarEnabled()) {
    redirect("/404")
  }

  const session = await auth()
  if (!session?.user?.id) {
    return <RadarMarketingLanding />
  }

  let supplierKind: SupplierKind = "unset"
  let brandName: string | null = null
  const kindChromeEnabled = session.user.role === "SUPPLIER"
  if (kindChromeEnabled) {
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { supplierKind: true, name: true },
    })
    supplierKind = parseSupplierKind(profile?.supplierKind)
    brandName = profile?.name ?? null
  }

  const planUser = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro ?? false,
    features: session.user.features,
  }
  const plan = getUserRadarPlan(planUser)
  const access = checkRadarAccess(planUser, "dashboard")

  if (!access.allowed || plan.id === "free" || plan.id === "starter") {
    const teaser = RADAR_DEMO_WINNERS.slice(0, 3)
    return (
      <RadarKindCockpit supplierKind={supplierKind} enabled={kindChromeEnabled}>
        <div className="space-y-6">
          <RadarPaywallPanel
            plan={plan}
            title="Débloque Radar Global à $99/m"
            reason="Voir winners BR avant tes concurrents — Map, alertes Slack, crawl mondial."
          >
            <div className="p-6">
              <p className="text-sm font-medium text-zinc-800">Aperçu winners (teaser)</p>
              <ul className="mt-3 space-y-2">
                {teaser.map((w) => (
                  <li key={w.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                    #{w.rank} {w.title} · {w.country}
                  </li>
                ))}
              </ul>
            </div>
          </RadarPaywallPanel>
          <p className="text-center text-sm text-zinc-500">
            Déjà Pro ?{" "}
            <Link href="/pricing?feature=radar" className="font-medium text-violet-600">
              Activer Radar
            </Link>
          </p>
        </div>
      </RadarKindCockpit>
    )
  }

  const params = await searchParams
  const marketplaceFilter = params.marketplace?.trim().toLowerCase() ?? ""
  const countryFilter = params.country?.trim().toUpperCase() ?? ""
  const q = params.q?.trim() ?? ""
  const justConnected = params.connected === "1"

  let demoMode = false
  let shopConnections: Array<{
    id: string
    shopId: string
    shopName: string
    connectorId: string
  }> = []
  let globalCount = 0
  let latestWinners: WinnerRow[] = []
  let trending: Awaited<ReturnType<typeof getTrendingKeywords>> = []
  let tiktokSales: TikTokSalesDashboard | null = null

  if (!resolveRadarDatabaseUrl()) {
    demoMode = true
    console.warn("[radar/dashboard]", { result: "demo_mode", reason: "no_database_url" })
  } else {
    try {
      const db = getRadarDb()
      const winnerWhere: Prisma.RadarGlobalSnapshotWhereInput = {
        rank: { lte: 20 },
      }
      if (marketplaceFilter === "tiktok" || marketplaceFilter === "tiktok_shop") {
        winnerWhere.marketplaceId = "tiktok_shop"
      } else if (marketplaceFilter === "amazon") {
        winnerWhere.marketplaceId = "amazon"
      } else if (marketplaceFilter === "shopify") {
        winnerWhere.marketplaceId = "shopify"
      }
      if (countryFilter) winnerWhere.country = countryFilter
      if (q) {
        winnerWhere.title = { contains: q, mode: "insensitive" }
      }

      const [shops, count, winners, trends] = await Promise.all([
        db.shopConnection.findMany({
          where: { userId: session.user.id },
          select: {
            id: true,
            shopId: true,
            shopName: true,
            connectorId: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        db.radarGlobalSnapshot.count(),
        db.radarGlobalSnapshot.findMany({
          where: winnerWhere,
          orderBy: { crawledAt: "desc" },
          take: 20,
        }),
        getTrendingKeywords(TREND_SEEDS).catch((err) => {
          console.error("[radar/dashboard]", {
            result: "trends_failed",
            message: err instanceof Error ? err.message : "unknown",
          })
          return []
        }),
      ])

      shopConnections = shops
      globalCount = count
      latestWinners = winners
      trending = trends

      const tiktokShopIds = shops
        .filter((s) => s.connectorId === "tiktok_shop")
        .map((s) => s.shopId)
      const showTikTokSales =
        marketplaceFilter === "" ||
        marketplaceFilter === "tiktok" ||
        marketplaceFilter === "tiktok_shop"
      if (showTikTokSales && tiktokShopIds.length > 0) {
        const to = new Date()
        const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
        tiktokSales = await getTikTokSalesDashboard({
          shopIds: tiktokShopIds,
          from,
          to,
        }).catch((err) => {
          console.error("[radar/dashboard]", {
            result: "tiktok_sales_failed",
            message: err instanceof Error ? err.message : "unknown",
          })
          return null
        })
      }
    } catch (err) {
      demoMode = true
      console.warn("[radar/dashboard]", {
        result: "demo_mode",
        reason: "db_offline",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  if (demoMode) {
    latestWinners = RADAR_DEMO_WINNERS
    globalCount = RADAR_DEMO_WINNERS.length
  }

  const lastScan = latestWinners[0]?.crawledAt ?? null
  const hotTrends = trending.filter((t) => t.growth > 50)
  const awaitingCrawlerKeys = !demoMode && globalCount === 0
  const hasTikTokConnection = shopConnections.some((s) => s.connectorId === "tiktok_shop")
  const showTikTokSalesSection =
    marketplaceFilter === "" ||
    marketplaceFilter === "tiktok" ||
    marketplaceFilter === "tiktok_shop"

  return (
    <RadarKindCockpit supplierKind={supplierKind} enabled={kindChromeEnabled}>
      <div className="space-y-8">
      {justConnected && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Source connectée avec succès.
        </div>
      )}

      {demoMode && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Radar DB offline, mode demo — affichage de 5 produits mock. Vérifie{" "}
          <code className="rounded bg-amber-100 px-1">RADAR_DATABASE_URL</code> / Neon.
        </div>
      )}

      {awaitingCrawlerKeys && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ⚠️ Radar en attente de clés crawler. Ajoute{" "}
          <code className="rounded bg-amber-100 px-1">TIKTOK_CRAWLER_ACCESS_TOKEN</code> et{" "}
          <code className="rounded bg-amber-100 px-1">SERPER_API_KEY</code> dans Vercel Env pour
          activer le scan mondial.
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-900">
              📡 Radar actif: {globalCount.toLocaleString("fr-FR")} produits trackés |{" "}
              {shopConnections.length} shops connectés | Dernier scan: {formatScanDate(lastScan)}
              {demoMode ? " (demo)" : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Veille bestsellers + Trends — scan auto toutes les 6h.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/radar/connect"
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Connecter
            </Link>
            <Link href="/radar/winners" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Winners
            </Link>
            <RadarForceScanButton
              disabled={awaitingCrawlerKeys || demoMode}
              label={awaitingCrawlerKeys ? "Forcer scan" : "Forcer Scan"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Suspense fallback={<div className="text-sm text-zinc-500">Filtres…</div>}>
          <RadarDashboardFilters />
        </Suspense>
      </section>

      {showTikTokSalesSection && (
        <RadarTikTokSalesSection
          dashboard={tiktokSales}
          hasConnection={hasTikTokConnection}
        />
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          🔥 Top 20 Bestsellers Mondiaux {demoMode ? "(Demo)" : "(Live)"}
          {supplierKind === "producer" && brandName ? (
            <span className="ml-2 text-xs font-normal text-violet-600">
              · highlight marque « {brandName} »
            </span>
          ) : null}
        </h2>
        {latestWinners.length === 0 ? (
          <div className="mt-4 space-y-3">
            <div className="overflow-x-auto rounded-lg border border-dashed border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-2 py-2">Rank</th>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Marketplace</th>
                    <th className="px-2 py-2">Price</th>
                    <th className="px-2 py-2">Country</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-zinc-500">
                      Aucun snapshot — configure les clés crawler puis attends le cron 6h.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <RadarForceScanButton disabled label="Forcer scan" />
            </div>
          </div>
        ) : (
          <WinnersTable
            rows={latestWinners}
            brandHighlight={supplierKind === "producer" ? brandName : null}
          />
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">📈 Trending Keywords</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Seeds: {TREND_SEEDS.join(", ")} — growth &gt; 50%
        </p>
        {hotTrends.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Aucun mot-clé en forte croissance (configure `SERPER_API_KEY` / `SERPAPI_API_KEY`).
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hotTrends.map((t) => (
              <li
                key={t.keyword}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-zinc-900">{t.keyword}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  volume {t.volume.toLocaleString("fr-FR")} ·{" "}
                  <span className="font-semibold text-emerald-700">+{t.growth}%</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">Shops connectés</h2>
          <Link href="/radar/connect" className="text-sm font-medium text-violet-600">
            Scanner un marketplace
          </Link>
        </div>
        {shopConnections.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Aucun shop — connecte TikTok, Amazon ou Google Merchant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {shopConnections.map((s) => (
              <li
                key={s.id}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700"
              >
                {getConnectorById(s.connectorId)?.logo ?? "📡"} {s.shopName}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </RadarKindCockpit>
  )
}
