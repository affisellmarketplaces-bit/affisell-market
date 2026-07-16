import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getRadarDb } from "@/lib/prisma-radar"
import { getConnectorById } from "@/lib/radar/connectors/registry"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { isRadarEnabled } from "@/lib/radar/gate"

function signalStatus(expiresAt: Date | null, status: string): "Actif" | "Expiré" {
  if (status !== "active") return "Expiré"
  if (!expiresAt) return "Actif"
  return expiresAt.getTime() > Date.now() ? "Actif" : "Expiré"
}

async function syncProductsStub(formData: FormData) {
  "use server"
  const shopId = String(formData.get("shopId") ?? "").trim()
  const connectorId = String(formData.get("connectorId") ?? "").trim()
  console.log("[radar]", { shopId, connectorId, result: "sync_products_stub" })
}

export default async function RadarDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>
}) {
  if (!isRadarEnabled()) {
    redirect("/404")
  }

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const features = resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) {
    redirect("/pricing")
  }

  const shops = await getRadarDb().shopConnection.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      shopId: true,
      shopName: true,
      connectorId: true,
      region: true,
      expiresAt: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const params = await searchParams
  const justConnected = params.connected === "1"

  return (
    <div className="space-y-6">
      {justConnected && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Source connectée avec succès.
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Sources connectées</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Signaux marketplaces et Google reliés à votre compte Affisell Radar.
            </p>
          </div>
          {shops.length > 0 && (
            <Link
              href="/radar/connect"
              className="shrink-0 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Scanner un marketplace
            </Link>
          )}
        </div>

        {shops.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center">
            <p className="text-base font-medium text-zinc-900">Aucun signal sur le radar. 📡</p>
            <p className="mt-1 text-sm text-zinc-600">
              Connectez un marketplace ou Google pour démarrer la veille.
            </p>
            <Link
              href="/radar/connect"
              className="mt-5 inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Scanner un marketplace
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {shops.map((shop) => {
              const connector = getConnectorById(shop.connectorId)
              const status = signalStatus(shop.expiresAt, shop.status)
              const isActive = status === "Actif"
              return (
                <li
                  key={shop.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg" aria-hidden>
                          {connector?.logo ?? "📡"}
                        </span>
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {shop.shopName}
                        </p>
                        <span
                          className={
                            isActive
                              ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                              : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          }
                        >
                          {isActive && (
                            <span className="relative flex size-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                            </span>
                          )}
                          {isActive ? "Signal Actif" : "Expiré"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {connector?.name ?? shop.connectorId} · {shop.region}
                      </p>
                      <p className="font-mono text-xs text-zinc-600">shopId: {shop.shopId}</p>
                      <p className="text-xs text-zinc-500">
                        Connecté le{" "}
                        {shop.createdAt.toLocaleString("fr-FR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <form action={syncProductsStub}>
                      <input type="hidden" name="shopId" value={shop.shopId} />
                      <input type="hidden" name="connectorId" value={shop.connectorId} />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                      >
                        Sync
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
