import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isAutoDsConfigured } from "@/lib/autods/config"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminAutoDsIntegrationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/integrations/autods")
  if (session.user.role !== "ADMIN") redirect("/")

  const credentials = await prisma.wooCommerceApiCredential.findMany({
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const apiReady = isAutoDsConfigured()
  const storeUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://affisell.com").replace(/\/$/, "")

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/admin/auto-fulfill" className="text-xs font-medium text-violet-600 hover:underline">
            ← Auto-fulfill
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">AutoDS × Affisell</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Affisell n&apos;est pas WordPress — utilisez le pont WooCommerce ci-dessous pour l&apos;onboarding
            AutoDS, puis l&apos;API interne pour l&apos;auto-fulfillment.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Connecter la boutique dans AutoDS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                AutoDS → <strong>Add Store</strong> → choisissez <strong>WooCommerce</strong>
              </li>
              <li>
                Store URL&nbsp;: <code>{storeUrl}</code> (sans slash final)
              </li>
              <li>
                AutoDS ouvre <code>/wc-auth/v1/authorize</code> — connectez-vous en admin Affisell et
                cliquez <strong>Approuver</strong>
              </li>
              <li>
                Notez le <strong>Store ID</strong> AutoDS puis renseignez <code>AUTODS_STORE_ID</code> sur
                Vercel
              </li>
            </ol>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Ne configurez pas un vrai site WordPress/WooCommerce en parallèle sur le même domaine.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              2. API AutoDS (fulfillment)
              <Badge variant={apiReady ? "accent" : "outline"}>{apiReady ? "Configurée" : "Manquante"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Variables Vercel&nbsp;: <code>AUTODS_API_KEY</code>, <code>AUTODS_STORE_ID</code>,{" "}
              <code>AUTODS_STORE_NAME</code>, webhook →{" "}
              <code>{storeUrl}/api/webhooks/autods</code>
            </p>
            <p>
              Activez <strong>Allow order creation via API</strong> dans AutoDS → Settings → Integrations →
              API.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clés WooCommerce émises</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {credentials.length === 0 ? (
              <p className="text-zinc-500">Aucune connexion approuvée pour l&apos;instant.</p>
            ) : (
              credentials.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <p className="font-medium text-zinc-900 dark:text-white">{row.appName}</p>
                  <p className="text-xs text-zinc-500">
                    scope {row.scope} · user {row.externalUserId} ·{" "}
                    {row.createdAt.toISOString().slice(0, 10)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {row.consumerKey.slice(0, 12)}…
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
