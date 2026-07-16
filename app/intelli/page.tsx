import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { resolveMarketIntelliFeatures } from "@/lib/market-intelli/features"
import { isMarketIntelliEnabled } from "@/lib/market-intelli/gate"
import { getMiDb } from "@/lib/prisma-mi"

function shopStatus(expiresAt: Date): "Actif" | "Expiré" {
  return expiresAt.getTime() > Date.now() ? "Actif" : "Expiré"
}

async function syncProductsStub(formData: FormData) {
  "use server"
  const shopId = String(formData.get("shopId") ?? "").trim()
  console.log("[intelli]", { shopId, result: "sync_products_stub" })
}

export default async function IntelliDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>
}) {
  if (!isMarketIntelliEnabled()) {
    redirect("/404")
  }

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const features = resolveMarketIntelliFeatures(session.user.id, session.user.isPro ?? false)
  if (!features.includes("market_intelli")) {
    redirect("/pricing")
  }

  const shops = await getMiDb().shopConnection.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      shopId: true,
      shopName: true,
      expiresAt: true,
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
          TikTok Shop connecté avec succès.
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Shops connectés</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Boutiques TikTok Shop liées à votre compte Market Intelli.
            </p>
          </div>
          {shops.length > 0 && (
            <Link
              href="/intelli/connect"
              className="shrink-0 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Ajouter
            </Link>
          )}
        </div>

        {shops.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">Aucun shop connecté</p>
            <p className="mt-1 text-sm text-zinc-600">
              Autorisez Affisell à lire vos produits, commandes et analytics TikTok Shop.
            </p>
            <Link
              href="/intelli/connect"
              className="mt-4 inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Connecter TikTok Shop
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {shops.map((shop) => {
              const status = shopStatus(shop.expiresAt)
              const isActive = status === "Actif"
              return (
                <li
                  key={shop.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {shop.shopName}
                        </p>
                        <span
                          className={
                            isActive
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                              : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          }
                        >
                          {status}
                        </span>
                      </div>
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
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                      >
                        Sync produits
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
