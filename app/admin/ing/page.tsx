import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { IngOpsDashboard } from "@/components/admin/ing-ops-dashboard"
import { auth } from "@/auth"
import { isIngDashboardEnabled } from "@/lib/ing/ing-ops-config"
import { loadIngOpsStats } from "@/lib/ing/load-ing-ops-stats"
import { fulfillmentPrisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Ing Ops | Affisell Admin",
  robots: { index: false, follow: false },
}

export default async function AdminIngOpsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/ing")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  if (!isIngDashboardEnabled()) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-zinc-500">
        Ing dashboard disabled — unset <code className="text-zinc-300">ING_DASHBOARD_ENABLED=false</code> on Vercel or set{" "}
        <code className="text-zinc-300">ING_DASHBOARD_ENABLED=true</code>
      </div>
    )
  }

  let initialStats = null
  let loadError: string | null = null
  try {
    initialStats = await loadIngOpsStats(fulfillmentPrisma)
  } catch (error) {
    loadError = error instanceof Error ? error.message : "stats_bootstrap_failed"
    console.error("[admin:ing]", { result: "page_bootstrap_error", error: loadError })
  }

  return <IngOpsDashboard initialStats={initialStats} loadError={loadError} />
}
