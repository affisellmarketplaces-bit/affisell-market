import { redirect } from "next/navigation"

import { AdminSupplyImportTester } from "@/components/admin/admin-supply-import-tester"
import { SupplyHubPanel } from "@/components/supplier/supply-hub-panel"
import { auth } from "@/auth"
import { loadSupplyHubSnapshot } from "@/lib/supplier/load-supply-hub-snapshot"
import { SUPPLY_HUB_UNLOCKED_CHANNELS } from "@/lib/supplier/supply-hub-shared"

export const dynamic = "force-dynamic"

/**
 * Supply Lab — vue admin déverrouillée des connecteurs.
 * Côté fournisseurs, tout sauf Stock Affisell + Manuel reste « soon »
 * (SUPPLY_HUB_UNLOCKED_CHANNELS) tant qu’un canal n’est pas validé ici.
 */
export default async function AdminSupplyLabPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/supply-lab")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const snapshot = await loadSupplyHubSnapshot(session.user.id, { unlockAll: true })

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Supply Lab
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connecteurs en conditions réelles (statuts déverrouillés). Côté fournisseurs, seuls{" "}
          {[...SUPPLY_HUB_UNLOCKED_CHANNELS].join(" + ")} sont actifs — le reste est affiché «
          soon » jusqu’à validation ici. Pour débloquer un canal : l’ajouter à
          SUPPLY_HUB_UNLOCKED_CHANNELS (lib/supplier/supply-hub-shared.ts).
        </p>
      </header>

      <AdminSupplyImportTester />

      <SupplyHubPanel snapshot={snapshot} />
    </main>
  )
}
