import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { resolveMarketIntelliFeatures } from "@/lib/market-intelli/features"
import { getMiShopConnection } from "@/lib/market-intelli/shop-connection"
import { isMarketIntelliEnabled } from "@/lib/market-intelli/gate"

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

  const connection = await getMiShopConnection(session.user.id)
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
        <h2 className="text-base font-semibold text-zinc-900">Vue d&apos;ensemble</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Synchronisez votre boutique TikTok Shop pour suivre produits, commandes et analytics.
        </p>

        {connection ? (
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Boutique</dt>
              <dd className="font-medium text-zinc-900">{connection.shopName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Shop ID</dt>
              <dd className="font-mono text-xs text-zinc-800">{connection.shopId}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Token expire</dt>
              <dd className="text-zinc-800">{connection.expiresAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Scopes</dt>
              <dd className="text-zinc-800">{connection.scopes.join(", ") || "—"}</dd>
            </div>
          </dl>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">Connectez votre TikTok Shop</p>
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
        )}
      </section>
    </div>
  )
}
