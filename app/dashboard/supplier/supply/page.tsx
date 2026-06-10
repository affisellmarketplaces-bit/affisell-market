import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { AgentNetworkPanel } from "@/components/supplier/agent-network-panel"
import { AutoBuyPilotPanel } from "@/components/supplier/auto-buy-pilot-panel"
import { ChinaBuyRoutesPanel } from "@/components/supplier/china-buy-routes-panel"
import { SupplyHubPanel } from "@/components/supplier/supply-hub-panel"
import { buttonVariants } from "@/components/ui/button"
import { loadAgentNetworkSnapshot } from "@/lib/agents/load-agent-network"
import { loadChinaBuySnapshot } from "@/lib/china-buying/load-china-buy-snapshot"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { loadAutoBuyPilotSnapshot } from "@/lib/supplier/load-auto-buy-pilot"
import { loadSupplyHubSnapshot } from "@/lib/supplier/load-supply-hub-snapshot"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierSupplyHubPage() {
  const session = await requireSupplierSession("/dashboard/supplier/supply")

  let snapshot: Awaited<ReturnType<typeof loadSupplyHubSnapshot>>
  let pilot: Awaited<ReturnType<typeof loadAutoBuyPilotSnapshot>>
  let agentNetwork: Awaited<ReturnType<typeof loadAgentNetworkSnapshot>>
  let chinaBuy: Awaited<ReturnType<typeof loadChinaBuySnapshot>>
  try {
    ;[snapshot, pilot, agentNetwork, chinaBuy] = await Promise.all([
      loadSupplyHubSnapshot(session.user.id),
      loadAutoBuyPilotSnapshot(session.user.id),
      loadAgentNetworkSnapshot(session.user.id),
      loadChinaBuySnapshot(session.user.id),
    ])
  } catch (error) {
    console.error("[supply-hub/page] load failed", { supplierId: session.user.id, error })
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Supply Hub temporairement indisponible
        </p>
        <p className="mt-2 text-sm text-zinc-500">Réessayez dans quelques instants.</p>
        <Link
          href="/dashboard/supplier"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6")}
        >
          Retour au tableau de bord
        </Link>
      </main>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/supplier"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-6 inline-flex gap-2 text-zinc-600 dark:text-zinc-300"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Tableau de bord
      </Link>
      <div className="space-y-8">
        <AutoBuyPilotPanel snapshot={pilot} />
        <ChinaBuyRoutesPanel snapshot={chinaBuy} />
        <AgentNetworkPanel snapshot={agentNetwork} />
        <SupplyHubPanel snapshot={snapshot} />
      </div>
    </div>
  )
}
