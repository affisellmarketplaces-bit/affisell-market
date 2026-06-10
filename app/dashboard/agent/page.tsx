import Link from "next/link"

import { AgentMissionWorkspace } from "@/components/agent/agent-mission-workspace"
import { toMissionRow } from "@/lib/agents/load-agent-network"
import { requireAgentSession } from "@/lib/dashboard-session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AgentDashboardPage() {
  const session = await requireAgentSession("/dashboard/agent")

  const profile = await prisma.sourcingAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      status: true,
      country: true,
      city: true,
      missionsDone: true,
      ratingX10: true,
      leadTimeHours: true,
      balanceCents: true,
      lifetimeEarningsCents: true,
    },
  })
  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-zinc-600">Profil agent introuvable — contactez agents@affisell.com</p>
      </main>
    )
  }

  const missions = await prisma.agentMission.findMany({
    where: { agentId: profile.id },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      instructions: true,
      reportSummary: true,
      photoUrls: true,
      feeCents: true,
      autoBuyPaused: true,
      requestedAt: true,
      completedAt: true,
      product: { select: { name: true, images: true } },
      agent: { select: { displayName: true, country: true, city: true } },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 60,
  })

  const rows = missions.map((m) => toMissionRow(m as Parameters<typeof toMissionRow>[0]))

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
          Agent Network
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {profile.displayName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {profile.city}, {profile.country} · {(profile.ratingX10 / 10).toFixed(1)}★ ·{" "}
          {profile.missionsDone} missions · SLA {profile.leadTimeHours} h
        </p>
        <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Solde {(profile.balanceCents / 100).toFixed(2)} € · Gains totaux{" "}
          {(profile.lifetimeEarningsCents / 100).toFixed(2)} €
        </p>
        {profile.status === "PAUSED" ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Compte en pause</p>
        ) : null}
        <p className="mt-3 text-xs text-zinc-500">
          Première connexion ?{" "}
          <Link href="/auth/forgot-password?portal=agent" className="text-cyan-700 underline dark:text-cyan-400">
            Définir votre mot de passe
          </Link>
        </p>
      </header>

      <AgentMissionWorkspace missions={rows} agentPaused={profile.status === "PAUSED"} />
    </main>
  )
}
