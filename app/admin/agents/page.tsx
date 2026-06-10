import { redirect } from "next/navigation"

import { AdminAgentMissionQueue } from "@/components/admin/admin-agent-mission-queue"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Agent Network — pilotage admin : réseau d'agents mondiaux + file de missions.
 * Quality Gate : passer une mission en FAILED coupe l'auto-buy du SKU.
 */
export default async function AdminAgentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/agents")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const [agents, missions] = await Promise.all([
    prisma.sourcingAgent.findMany({
      orderBy: [{ status: "asc" }, { ratingX10: "desc" }],
      take: 100,
    }),
    prisma.agentMission.findMany({
      select: {
        id: true,
        type: true,
        status: true,
        feeCents: true,
        autoBuyPaused: true,
        reportSummary: true,
        requestedAt: true,
        product: { select: { id: true, name: true } },
        agent: { select: { id: true, displayName: true, country: true } },
        supplierId: true,
      },
      orderBy: { requestedAt: "desc" },
      take: 80,
    }),
  ])

  const supplierIds = [...new Set(missions.map((m) => m.supplierId))]
  const suppliers = supplierIds.length
    ? await prisma.user.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, email: true, name: true },
      })
    : []
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name || s.email || s.id]))

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Agent Network
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Agents mondiaux (QC, conformité, photo, relais express) et file de missions.
          Quality Gate : une mission « Échec » coupe automatiquement l&apos;auto-buy du SKU.
          Seed du réseau : <code>npm run agents:seed</code>.
        </p>
      </header>

      <AdminAgentMissionQueue
        missions={missions.map((m) => ({
          id: m.id,
          type: m.type,
          status: m.status,
          feeCents: m.feeCents,
          autoBuyPaused: m.autoBuyPaused,
          reportSummary: m.reportSummary,
          requestedAt: m.requestedAt.toISOString(),
          productName: m.product?.name ?? null,
          agentName: m.agent ? `${m.agent.displayName} (${m.agent.country})` : null,
          supplierLabel: supplierById.get(m.supplierId) ?? m.supplierId,
        }))}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Réseau ({agents.length} agents)
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Agent</th>
                <th className="py-2 pr-4 font-medium">Localisation</th>
                <th className="py-2 pr-4 font-medium">Capacités</th>
                <th className="py-2 pr-4 font-medium">Note</th>
                <th className="py-2 pr-4 font-medium">Missions</th>
                <th className="py-2 pr-4 font-medium">Délai</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {a.displayName}
                  </td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {a.city}, {a.country}
                  </td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {a.capabilities.join(" · ")}
                  </td>
                  <td className="py-2 pr-4">{(a.ratingX10 / 10).toFixed(1)}★</td>
                  <td className="py-2 pr-4">{a.missionsDone}</td>
                  <td className="py-2 pr-4">{a.leadTimeHours} h</td>
                  <td className="py-2">
                    <span
                      className={
                        a.status === "ACTIVE"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                      }
                    >
                      {a.status === "ACTIVE" ? "Actif" : "Pause"}
                    </span>
                  </td>
                </tr>
              ))}
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    Aucun agent — lancez <code>npm run agents:seed</code>.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
