import Link from "next/link"
import { redirect } from "next/navigation"

import { RadarKindCockpit } from "@/components/radar/radar-kind-cockpit"
import RadarMarketingLanding from "@/components/radar/radar-marketing-landing"
import RadarPaywallPanel from "@/components/radar/radar-paywall-panel"
import RadarTikTokSalesSection from "@/components/radar/radar-tiktok-sales-section"
import WorldRadarTerminal from "@/components/radar/world-radar-terminal"
import { RadarLegalDisclaimer } from "@/components/radar/radar-legal-disclaimer"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getRadarDb } from "@/lib/prisma-radar"
import { getTikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"
import type { TikTokSalesDashboard } from "@/lib/radar/aggregators/tiktok"
import { countSupplierFrRadarProducts } from "@/lib/radar/affisell-fr-catalog.server"
import { resolveRadarDashboardCountry } from "@/lib/radar/dashboard-country.server"
import { RADAR_DEMO_WINNERS } from "@/lib/radar/demo-data"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getConnectorById } from "@/lib/radar/connectors/registry"
import { loadRadarPlanContext } from "@/lib/radar/plan-user.server"
import { parseSupplierKind, type SupplierKind } from "@/lib/supplier-kind"

export const revalidate = 3600

export default async function RadarDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string
    marketplace?: string
    country?: string
    q?: string
    debug?: string
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
  const kindChromeEnabled =
    session.user.role === "SUPPLIER" || session.user.role === "AFFILIATE"
  if (session.user.role === "SUPPLIER") {
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { supplierKind: true, name: true },
    })
    supplierKind = parseSupplierKind(profile?.supplierKind)
    brandName = profile?.name ?? null
  }

  const { planUser, plan } = await loadRadarPlanContext({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro,
    features: session.user.features,
  })
  const access = checkRadarAccess(planUser, "dashboard")

  if (!access.allowed || plan.id === "free" || plan.id === "starter") {
    const teaser = RADAR_DEMO_WINNERS.slice(0, 3)
    return (
      <RadarKindCockpit
        supplierKind={supplierKind}
        radarPlanId={plan.id}
        role={session.user.role}
        enabled={kindChromeEnabled}
      >
        <div className="space-y-6">
          <RadarPaywallPanel
            plan={plan}
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

  if (!params.country?.trim()) {
    const qs = new URLSearchParams()
    if (params.marketplace?.trim()) qs.set("marketplace", params.marketplace.trim())
    if (params.q?.trim()) qs.set("q", params.q.trim())
    if (params.connected === "1") qs.set("connected", "1")
    if (params.debug === "1") qs.set("debug", "1")
    qs.set("country", "FR")
    redirect(`/radar?${qs.toString()}`)
  }

  const marketplaceFilter = params.marketplace?.trim().toLowerCase() ?? ""
  const effectiveCountry = resolveRadarDashboardCountry(params.country)
  const justConnected = params.connected === "1"
  const showDebug = params.debug === "1"
  const isSupplierRole = session.user.role === "SUPPLIER"

  let shopConnections: Array<{
    id: string
    shopId: string
    shopName: string
    connectorId: string
  }> = []
  let tiktokSales: TikTokSalesDashboard | null = null
  let supplierFrProductCount = 0

  if (resolveRadarDatabaseUrl()) {
    try {
      const db = getRadarDb()
      const [shops, supplierCount] = await Promise.all([
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
        isSupplierRole
          ? countSupplierFrRadarProducts(session.user.id)
          : Promise.resolve(0),
      ])

      shopConnections = shops
      supplierFrProductCount = supplierCount

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
      console.warn("[radar/dashboard]", {
        result: "side_data_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  const hasTikTokConnection = shopConnections.some((s) => s.connectorId === "tiktok_shop")
  const showTikTokSalesSection =
    marketplaceFilter === "" ||
    marketplaceFilter === "tiktok" ||
    marketplaceFilter === "tiktok_shop"
  const showShopsSection = !isSupplierRole || showDebug

  return (
    <RadarKindCockpit
      supplierKind={supplierKind}
      radarPlanId={plan.id}
      role={session.user.role}
      enabled={kindChromeEnabled}
    >
      <div className="space-y-8">
        {justConnected ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Source connectée avec succès.
          </div>
        ) : null}

        <WorldRadarTerminal initialCountry={effectiveCountry} supplierKind={supplierKind} />

        {showTikTokSalesSection ? (
          <RadarTikTokSalesSection
            dashboard={tiktokSales}
            hasConnection={hasTikTokConnection}
          />
        ) : null}

        {isSupplierRole && !showDebug ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">📦 Tes produits en Radar</h2>
            <p className="mt-2 text-sm text-zinc-700">
              {supplierFrProductCount > 0
                ? `${supplierFrProductCount} produit${supplierFrProductCount > 1 ? "s" : ""} actif${supplierFrProductCount > 1 ? "s" : ""} avec Stock FR — Badge 24/48h activé.`
                : "Publie ton premier produit Stock FR pour apparaître dans le Radar Grossiste."}
            </p>
            {supplierFrProductCount === 0 ? (
              <Link
                href="/supplier/products/new"
                className="mt-4 inline-flex text-sm font-semibold text-emerald-800 hover:underline"
              >
                Ajouter un produit Stock FR →
              </Link>
            ) : null}
          </section>
        ) : null}

        {showShopsSection ? (
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
        ) : null}

        {supplierKind === "producer" && brandName ? (
          <p className="text-center text-xs text-violet-600">
            Mode Producteur — highlight marque « {brandName} » dans les winners FR Affisell.
          </p>
        ) : null}

        <RadarLegalDisclaimer />
      </div>
    </RadarKindCockpit>
  )
}
