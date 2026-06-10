import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminAgentApplications, type AdminAgentRow } from "@/components/admin/admin-agent-applications"
import { AdminAgentMissionQueue } from "@/components/admin/admin-agent-mission-queue"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const AGENT_SELECT = {
  id: true,
  displayName: true,
  country: true,
  city: true,
  capabilities: true,
  languages: true,
  leadTimeHours: true,
  contactEmail: true,
  contactPhone: true,
  applicationNote: true,
  status: true,
  ratingX10: true,
  missionsDone: true,
  createdAt: true,
} as const

function toRow(a: {
  id: string
  displayName: string
  country: string
  city: string
  capabilities: string[]
  languages: string[]
  leadTimeHours: number
  contactEmail: string
  contactPhone: string | null
  applicationNote: string | null
  status: string
  createdAt: Date
}): AdminAgentRow {
  return {
    id: a.id,
    displayName: a.displayName,
    country: a.country,
    city: a.city,
    capabilities: a.capabilities,
    languages: a.languages,
    leadTimeHours: a.leadTimeHours,
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    applicationNote: a.applicationNote,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }
}

/**
 * Agent Network — candidatures publiques + modération + file de missions.
 */
export default async function AdminAgentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/agents")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const [agents, missions] = await Promise.all([
    prisma.sourcingAgent.findMany({
      select: AGENT_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 120,
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

  const pending = agents.filter((a) => a.status === "PENDING").map(toRow)
  const roster = agents.filter((a) => a.status === "ACTIVE" || a.status === "PAUSED").map(toRow)

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
          Candidatures via{" "}
          <Link href="/agents/apply" className="text-violet-700 underline dark:text-violet-300">
            /agents/apply
          </Link>
          . Quality Gate : une mission « Échec » coupe l&apos;auto-buy du SKU. Seed :{" "}
          <code>npm run agents:seed</code> · comptes : <code>npm run agents:provision-users</code> ·{" "}
          <Link href="/login/agent" className="text-violet-700 underline dark:text-violet-300">
            /login/agent
          </Link>
          .
        </p>
      </header>

      <AdminAgentApplications pending={pending} roster={roster} />

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
    </main>
  )
}
