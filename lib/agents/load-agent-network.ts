import { prisma } from "@/lib/prisma"
import type {
  AgentCapabilityValue,
  AgentLite,
  AgentMissionStatusValue,
  AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"

export type AgentNetworkAgent = AgentLite & {
  status: "ACTIVE" | "PAUSED"
  languages: string[]
}

export type AgentMissionRow = {
  id: string
  type: AgentMissionTypeValue
  status: AgentMissionStatusValue
  productId: string | null
  productName: string | null
  productImage: string | null
  agentName: string | null
  agentCountry: string | null
  agentCity: string | null
  instructions: string | null
  reportSummary: string | null
  photoUrls: string[]
  feeCents: number
  autoBuyPaused: boolean
  requestedAt: string
  completedAt: string | null
}

export type AgentNetworkSnapshot = {
  agents: AgentNetworkAgent[]
  missions: AgentMissionRow[]
  /** SKUs éligibles à une mission (actifs, du fournisseur). */
  skus: { productId: string; name: string; importSource: string | null; sourceUrl: string | null }[]
  stats: {
    agentCount: number
    countryCount: number
    activeMissions: number
    passedMissions: number
    failedMissions: number
  }
}

const MISSION_SELECT = {
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
} as const

type MissionRecord = {
  id: string
  type: AgentMissionTypeValue
  status: AgentMissionStatusValue
  productId: string | null
  instructions: string | null
  reportSummary: string | null
  photoUrls: string[]
  feeCents: number
  autoBuyPaused: boolean
  requestedAt: Date
  completedAt: Date | null
  product: { name: string; images: string[] } | null
  agent: { displayName: string; country: string; city: string } | null
}

export function toMissionRow(m: MissionRecord): AgentMissionRow {
  return {
    id: m.id,
    type: m.type,
    status: m.status,
    productId: m.productId,
    productName: m.product?.name ?? null,
    productImage: m.product?.images[0] ?? null,
    agentName: m.agent?.displayName ?? null,
    agentCountry: m.agent?.country ?? null,
    agentCity: m.agent?.city ?? null,
    instructions: m.instructions,
    reportSummary: m.reportSummary,
    photoUrls: m.photoUrls,
    feeCents: m.feeCents,
    autoBuyPaused: m.autoBuyPaused,
    requestedAt: m.requestedAt.toISOString(),
    completedAt: m.completedAt?.toISOString() ?? null,
  }
}

/** Réseau d'agents + missions du fournisseur (Supply Hub → Agent Network). */
export async function loadAgentNetworkSnapshot(
  supplierId: string
): Promise<AgentNetworkSnapshot> {
  const [agents, missions, skus] = await Promise.all([
    prisma.sourcingAgent.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ ratingX10: "desc" }, { missionsDone: "desc" }],
      take: 60,
    }),
    prisma.agentMission.findMany({
      where: { supplierId },
      select: MISSION_SELECT,
      orderBy: { requestedAt: "desc" },
      take: 40,
    }),
    prisma.product.findMany({
      where: { supplierId, active: true },
      select: { id: true, name: true, importSource: true, sourceUrl: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ])

  const missionRows = missions.map((m) => toMissionRow(m as MissionRecord))
  const countries = new Set(agents.map((a) => a.country.toUpperCase()))

  const stats = {
    agentCount: agents.length,
    countryCount: countries.size,
    activeMissions: missionRows.filter((m) =>
      ["REQUESTED", "ASSIGNED", "IN_PROGRESS"].includes(m.status)
    ).length,
    passedMissions: missionRows.filter((m) => m.status === "PASSED").length,
    failedMissions: missionRows.filter((m) => m.status === "FAILED").length,
  }

  console.log("[agent-network]", {
    supplierId,
    agents: stats.agentCount,
    countries: stats.countryCount,
    missions: missionRows.length,
  })

  return {
    agents: agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      country: a.country,
      city: a.city,
      capabilities: a.capabilities as AgentCapabilityValue[],
      ratingX10: a.ratingX10,
      missionsDone: a.missionsDone,
      leadTimeHours: a.leadTimeHours,
      status: a.status,
      languages: a.languages,
    })),
    missions: missionRows,
    skus: skus.map((p) => ({
      productId: p.id,
      name: p.name,
      importSource: p.importSource,
      sourceUrl: p.sourceUrl,
    })),
    stats,
  }
}
